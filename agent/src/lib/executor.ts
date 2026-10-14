import { Page, Locator, request as playwrightRequest } from 'playwright';
import type { NetworkRecord } from './browser.js';
import { discoverOverlays, runOverlayInvariants, type InvariantResult } from './overlay.js';
import { runRapidSuite } from './rapid.js';
import { EventEmitter } from 'events';

export interface TestCase {
  id: string;
  name: string;
  category: 'security' | 'input' | 'navigation' | 'responsive' | 'accessibility';
  description: string;
  execute: (page: Page) => Promise<TestResult>;
}

export interface TestResult {
  testCaseId: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  message: string;
  evidence: string[];
  severity?: 'critical' | 'high' | 'medium' | 'low';
  /** What observation decided this verdict (e.g. 'dialog event', 'keyword match in page text'). */
  oracle?: string;
  /** How much the oracle can be trusted for this verdict. */
  confidence?: 'high' | 'medium' | 'low';
  details?: any;
}

export interface TestSuite {
  name: string;
  testCases: TestCase[];
}

export class TestExecutor extends EventEmitter {
  private page: Page;
  private results: TestResult[] = [];

  constructor(page: Page) {
    super();
    this.page = page;
  }

  async runTestSuite(suite: TestSuite): Promise<TestResult[]> {
    console.log(`\n🧪 Test suite başlatılıyor: ${suite.name}`);
    console.log(`   ${suite.testCases.length} test case bulundu`);

    for (const testCase of suite.testCases) {
      console.log(`\n▶️  Çalıştırılıyor: ${testCase.name}`);
      
      try {
        const result = await testCase.execute(this.page);
        this.results.push(result);
        
        const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
        console.log(`   ${icon} ${result.status.toUpperCase()}: ${result.message}`);
        
        this.emit('test:completed', result);
      } catch (error) {
        const result: TestResult = {
          testCaseId: testCase.id,
          status: 'fail',
          message: `Test execution error: ${(error as Error).message}`,
          evidence: [],
        };
        this.results.push(result);
        console.log(`   ❌ ERROR: ${(error as Error).message}`);
        
        this.emit('test:error', result);
      }
    }

    return this.results;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getPassedTests(): TestResult[] {
    return this.results.filter(r => r.status === 'pass');
  }

  getFailedTests(): TestResult[] {
    return this.results.filter(r => r.status === 'fail');
  }

  getWarnings(): TestResult[] {
    return this.results.filter(r => r.status === 'warning');
  }

  getSummary(): { total: number; passed: number; failed: number; warnings: number } {
    return {
      total: this.results.length,
      passed: this.getPassedTests().length,
      failed: this.getFailedTests().length,
      warnings: this.getWarnings().length,
    };
  }

  clearResults(): void {
    this.results = [];
  }

  reset(): void {
    this.results = [];
  }
}


// ============================================================
// GENERIC SEARCH-TARGET DISCOVERY (no site-specific selectors)
// ============================================================
export interface SearchTarget {
  searchBox: Locator;
  searchButton: Locator | null;
}

/** Find a visible search input (role/type/placeholder) and, if present, its submit control. */
export async function findSearchTarget(page: Page): Promise<SearchTarget | null> {
  const inputCandidates: Locator[] = [
    page.getByRole('searchbox'),
    page.locator('input[type="search"]'),
    page.getByPlaceholder(/search|find|ara|arama/i),
    page.locator('input[name="q"], input[name="query"], input[name="search"], input[name="s"]'),
  ];
  let searchBox: Locator | null = null;
  for (const c of inputCandidates) {
    const n = await c.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 5); i++) {
      const el = c.nth(i);
      if (await el.isVisible().catch(() => false)) { searchBox = el; break; }
    }
    if (searchBox) break;
  }
  if (!searchBox) return null;

  // Prefer a submit control inside the same form; fall back to a role=button named search.
  const form = page.locator('form').filter({ has: searchBox }).first();
  const buttonCandidates: Locator[] = [
    form.locator('button[type="submit"], input[type="submit"]'),
    form.getByRole('button', { name: /search|find|go|ara/i }),
    page.getByRole('button', { name: /search|find|ara/i }),
  ];
  let searchButton: Locator | null = null;
  for (const c of buttonCandidates) {
    const first = c.first();
    if (await first.isVisible().catch(() => false)) { searchButton = first; break; }
  }
  return { searchBox, searchButton };
}

/** Submit via the discovered button, or Enter in the input when the page has no explicit button. */
async function submitSearch(t: SearchTarget): Promise<void> {
  if (t.searchButton) await t.searchButton.click();
  else await t.searchBox.press('Enter');
}

function skipNoTarget(testCaseId: string): TestResult {
  return {
    testCaseId,
    status: 'skipped',
    message: 'skipped: no target element (no search input found by role/type/placeholder; this suite may need per-site selector configuration)',
    evidence: [],
  };
}

// ============================================================
// IMPROVED SECURITY TEST SUITE
// ============================================================
export function createSecurityTestSuite(): TestSuite {
  return {
    name: 'Security Tests',
    testCases: [
      {
        id: 'SEC-001',
        name: 'XSS Injection (Comprehensive)',
        category: 'security',
        description: 'Test for XSS vulnerabilities with comprehensive payloads',
        execute: async (page: Page): Promise<TestResult> => {
          const payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            '"><script>alert("XSS")</script>',
            "';alert('XSS')//",
            '<iframe src="javascript:alert(\'XSS\')">',
            '<body onload=alert("XSS")>',
            '<input onfocus=alert("XSS") autofocus>',
            '<marquee onstart=alert("XSS")>',
            '<details open ontoggle=alert("XSS")>',
          ];

              const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('SEC-001');
              const { searchBox } = target;

              let xssExecuted = false;
              let xssReflected = false;
              const evidence: string[] = [];
              const xssIndicators: string[] = [];
              const reflectedPayloads: string[] = [];

              // Listen for dialogs (XSS indicator)
              page.on('dialog', async dialog => {
                xssExecuted = true;
                xssIndicators.push(`Dialog appeared: ${dialog.message()}`);
                await dialog.dismiss();
              });

              for (const payload of payloads) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(payload);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  // Check if payload appears in DOM (reflected XSS)
                  const payloadInDOM = await page.evaluate((p) => {
                    return document.body.innerHTML.includes(p);
                  }, payload);

                  // Check for script execution indicators
                  const scriptExecuted = await page.evaluate(() => {
                    return (window as any).__xss_executed === true;
                  });

                  if (scriptExecuted) {
                    xssExecuted = true;
                    xssIndicators.push(`__xss_executed flag set after: ${payload.substring(0, 50)}`);
                  } else if (payloadInDOM) {
                    xssReflected = true;
                    reflectedPayloads.push(payload.substring(0, 50));
                  }

                  const screenshotPath = `evidence/xss-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  // Continue with next payload
                }
              }

              // Only execution (dialog / __xss_executed) is proof; reflection alone is a warning.
              if (xssExecuted) {
                return {
                  testCaseId: 'SEC-001',
                  status: 'fail',
                  message: `XSS executed: ${xssIndicators.join('; ')}`,
                  evidence,
                  severity: 'critical',
                  oracle: 'dialog event or __xss_executed flag observed after payload submission',
                  confidence: 'high',
                };
              }
              if (xssReflected) {
                return {
                  testCaseId: 'SEC-001',
                  status: 'warning',
                  message: `reflected, execution not proven (${reflectedPayloads.length} payload(s) present unescaped in DOM; verify manually)`,
                  evidence,
                  oracle: 'raw payload string found in document.body.innerHTML (reflection only; no dialog, no execution flag)',
                  confidence: 'low',
                };
              }
              return {
                testCaseId: 'SEC-001',
                status: 'pass',
                message: `No XSS execution or reflection observed (${payloads.length} payloads tested)`,
                evidence,
                oracle: 'no dialog, no __xss_executed flag, no raw reflection',
                confidence: 'medium',
              };
        },
      },
      {
        id: 'SEC-002',
        name: 'SQL Injection (Error-based)',
        category: 'security',
        description: 'Test for SQL injection using error-based techniques',
        execute: async (page: Page): Promise<TestResult> => {
          const payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users--",
            "' UNION SELECT * FROM users--",
            "1' ORDER BY 100--",
            "' AND 1=CONVERT(int,@@version)--",
            "'; EXEC xp_cmdshell('dir')--",
            "1' AND '1'='1",
            "admin'--",
            "' OR 1=1#",
            "1' UNION SELECT NULL,NULL,NULL--",
          ];

              const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('SEC-002');
              const { searchBox } = target;

              const evidence: string[] = [];
              let sqlErrorDetected = false;
              const sqlIndicators: string[] = [];

              // SQL error patterns
              const errorPatterns = [
                'sql', 'syntax', 'mysql', 'oracle', 'postgresql',
                'sqlite', 'microsoft sql', 'odbc', 'jdbc',
                'unterminated', 'query', 'column', 'table',
                'fetch', 'prepared', 'statement', 'sqlstate',
                'error', 'warning', 'fatal', 'exception',
              ];

              for (const payload of payloads) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(payload);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  // Check page content for SQL errors
                  const pageContent = await page.locator('body').innerText().catch(() => '');
                  const lowerContent = pageContent.toLowerCase();

                  for (const pattern of errorPatterns) {
                    if (lowerContent.includes(pattern)) {
                      sqlErrorDetected = true;
                      sqlIndicators.push(`Found "${pattern}" in response`);
                    }
                  }

                  // Check URL for SQL errors
                  const currentUrl = page.url();
                  if (lowerContent.includes('error') && lowerContent.includes('sql')) {
                    sqlErrorDetected = true;
                    sqlIndicators.push('SQL error page detected');
                  }

                  const screenshotPath = `evidence/sql-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  // Continue with next payload
                }
              }

              return {
                testCaseId: 'SEC-002',
                status: sqlErrorDetected ? 'fail' : 'pass',
                message: sqlErrorDetected
                  ? `SQL injection possible! ${sqlIndicators.join('; ')}`
                  : `No SQL injection vulnerabilities found (${payloads.length} payloads tested)`,
                evidence,
                severity: sqlErrorDetected ? 'critical' : undefined,
                oracle: 'keyword match (e.g. sql, error, query) in visible page text',
                confidence: 'low',
              };
        },
      },
      {
        id: 'SEC-003',
        name: 'HTML Injection',
        category: 'security',
        description: 'Test for HTML injection vulnerabilities',
        execute: async (page: Page): Promise<TestResult> => {
          const payloads = [
            '<button onclick="alert(\'Hacked\')">Click</button>',
            '<a href="http://evil.com">Click Here</a>',
            '<iframe src="http://evil.com"></iframe>',
            '<img src="http://evil.com/track.gif">',
            '<div style="background:url(http://evil.com/track)">',
            '<svg><use href="http://evil.com#xss"/></svg>',
            '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
            '<form action="http://evil.com"><input type="submit">',
          ];

              const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('SEC-003');
              const { searchBox } = target;

              const evidence: string[] = [];
              let htmlInjected = false;
              const injectionIndicators: string[] = [];

              for (const payload of payloads) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(payload);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  // Check if HTML was rendered
                  const injectedElement = await page.evaluate((p) => {
                    const body = document.body.innerHTML;
                    return body.includes(p);
                  }, payload);

                  if (injectedElement) {
                    htmlInjected = true;
                    injectionIndicators.push(`HTML rendered: ${payload.substring(0, 40)}`);
                  }

                  // Check for external resource loading
                  const externalLoaded = await page.evaluate(() => {
                    const links = document.querySelectorAll('link[href*="evil.com"]');
                    const scripts = document.querySelectorAll('script[src*="evil.com"]');
                    const iframes = document.querySelectorAll('iframe[src*="evil.com"]');
                    return links.length + scripts.length + iframes.length;
                  });

                  if (externalLoaded > 0) {
                    htmlInjected = true;
                    injectionIndicators.push(`External resources loaded: ${externalLoaded}`);
                  }

                  const screenshotPath = `evidence/html-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  // Continue with next payload
                }
              }

              return {
                testCaseId: 'SEC-003',
                status: htmlInjected ? 'fail' : 'pass',
                message: htmlInjected
                  ? `HTML injection successful! ${injectionIndicators.join('; ')}`
                  : `No HTML injection vulnerabilities found (${payloads.length} payloads tested)`,
                evidence,
                severity: htmlInjected ? 'high' : undefined,
                oracle: 'raw payload string present in document.body.innerHTML, or external resource element injected',
                confidence: 'medium',
              };
        },
      },
    ],
  };
}

// ============================================================
// IMPROVED INPUT TEST SUITE
// ============================================================
export function createInputTestSuite(): TestSuite {
  return {
    name: 'Input Tests',
    testCases: [
      {
        id: 'INPUT-001',
        name: 'Empty Form Submission',
        category: 'input',
        description: 'Test form submission with empty fields and check backend response',
        execute: async (page: Page): Promise<TestResult> => {
          const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('INPUT-001');
              const { searchBox } = target;

              const evidence: string[] = [];
              let backendError = false;
              const indicators: string[] = [];

              // Monitor network requests
              const requests: any[] = [];
              page.on('response', response => {
                requests.push({
                  url: response.url(),
                  status: response.status(),
                  headers: response.headers(),
                });
              });

              // Try empty submission
              await searchBox.fill('');
              await submitSearch(target);
              await page.waitForTimeout(3000);

              // Check for backend errors (5xx)
              const serverErrors = requests.filter(r => r.status >= 500);
              if (serverErrors.length > 0) {
                backendError = true;
                indicators.push(`Server errors: ${serverErrors.map(e => e.status).join(', ')}`);
              }

              // Check for error pages
              const errorPage = await page.locator('h1:has-text("Error"), h1:has-text("500"), h1:has-text("404")').isVisible().catch(() => false);
              if (errorPage) {
                backendError = true;
                indicators.push('Error page displayed');
              }

              // Check for stack traces
              const stackTrace = await page.locator('body').innerText().catch(() => '');
              if (stackTrace.includes('Stack Trace') || stackTrace.includes('Exception')) {
                backendError = true;
                indicators.push('Stack trace exposed');
              }

              const screenshotPath = `evidence/empty-submit-${Date.now()}.png`;
              await page.screenshot({ path: screenshotPath });
              evidence.push(screenshotPath);

              return {
                testCaseId: 'INPUT-001',
                status: backendError ? 'fail' : 'pass',
                message: backendError
                  ? `Empty submission caused backend error: ${indicators.join('; ')}`
                  : 'Empty submission handled gracefully',
                evidence,
                severity: backendError ? 'high' : undefined,
                details: { requests: requests.length, serverErrors: serverErrors.length },
              };
        },
      },
      {
        id: 'INPUT-002',
        name: 'Long String Input',
        category: 'input',
        description: 'Test with very long string input and check for crashes',
        execute: async (page: Page): Promise<TestResult> => {
          const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('INPUT-002');
              const { searchBox } = target;

              const evidence: string[] = [];
              let backendCrash = false;
              const indicators: string[] = [];

              // Monitor for crashes
              const requests: any[] = [];
              page.on('response', response => {
                requests.push({
                  url: response.url(),
                  status: response.status(),
                });
              });

              // Test with progressively longer strings
              const lengths = [1000, 5000, 10000, 50000];
              for (const length of lengths) {
                try {
                  const longString = 'A'.repeat(length);
                  await searchBox.fill('');
                  await searchBox.fill(longString);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  // Check for 500 errors
                  const serverErrors = requests.filter(r => r.status >= 500);
                  if (serverErrors.length > 0) {
                    backendCrash = true;
                    indicators.push(`Server crash at ${length} chars: ${serverErrors[0].status}`);
                  }

                  // Check for timeout
                  const pageContent = await page.locator('body').innerText().catch(() => '');
                  if (pageContent.includes('timeout') || pageContent.includes('Timeout')) {
                    backendCrash = true;
                    indicators.push(`Timeout at ${length} chars`);
                  }

                  const screenshotPath = `evidence/long-string-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  backendCrash = true;
                  indicators.push(`Exception at ${length} chars: ${(e as Error).message}`);
                }
              }

              return {
                testCaseId: 'INPUT-002',
                status: backendCrash ? 'fail' : 'pass',
                message: backendCrash
                  ? `Long string caused issues: ${indicators.join('; ')}`
                  : `Long strings handled gracefully (tested up to ${lengths[lengths.length - 1]} chars)`,
                evidence,
                severity: backendCrash ? 'medium' : undefined,
              };
        },
      },
      {
        id: 'INPUT-003',
        name: 'Special Characters Input',
        category: 'input',
        description: 'Test with special characters and check for injection',
        execute: async (page: Page): Promise<TestResult> => {
          const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('INPUT-003');
              const { searchBox } = target;

              const evidence: string[] = [];
              let issuesFound = false;
              const indicators: string[] = [];

              const specialChars = [
                '!@#$%^&*()_+-=[]{}|;:,.<>?',
                '""',
                "''",
                '\\',
                '`',
                '${}',
                '{{}}',
                '%%',
                '&amp; &lt; &gt;',
              ];

              for (const chars of specialChars) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(chars);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  // Check for XSS reflection
                  const reflected = await page.evaluate((c) => {
                    return document.body.innerHTML.includes(c);
                  }, chars);

                  if (reflected) {
                    issuesFound = true;
                    indicators.push(`Special chars reflected: ${chars.substring(0, 20)}`);
                  }

                  const screenshotPath = `evidence/special-chars-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  // Continue
                }
              }

              return {
                testCaseId: 'INPUT-003',
                status: issuesFound ? 'fail' : 'pass',
                message: issuesFound
                  ? `Special character issues: ${indicators.join('; ')}`
                  : `Special characters handled safely (${specialChars.length} sets tested)`,
                evidence,
                severity: issuesFound ? 'medium' : undefined,
              };
        },
      },
      {
        id: 'INPUT-004',
        name: 'Unicode Input',
        category: 'input',
        description: 'Test with Unicode characters and emojis',
        execute: async (page: Page): Promise<TestResult> => {
          const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('INPUT-004');
              const { searchBox } = target;

              const unicodeStrings = [
                '🎉🔥💯 問題ない',
                'Ñoño señor',
                'Ünlü famous',
                'Ürünler test',
                'Ñoño 問題ない',
                '🇨🇳🇯🇵🇰🇷',
                '\u0000\u0001\u0002',
                '-Menü-',
                'naïve résumé',
                'Ελληνικά',
              ];

              const evidence: string[] = [];
              let allPassed = true;
              const issues: string[] = [];

              for (const unicode of unicodeStrings) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(unicode);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  const screenshotPath = `evidence/unicode-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  // Check for encoding errors
                  const pageContent = await page.locator('body').innerText().catch(() => '');
                  if (pageContent.includes('encoding') || pageContent.includes('Unicode')) {
                    allPassed = false;
                    issues.push(`Encoding error with: ${unicode.substring(0, 20)}`);
                  }

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  allPassed = false;
                  issues.push(`Exception with: ${unicode.substring(0, 20)}`);
                }
              }

              return {
                testCaseId: 'INPUT-004',
                status: allPassed ? 'pass' : 'fail',
                message: allPassed
                  ? `Unicode input handled gracefully (${unicodeStrings.length} sets tested)`
                  : `Unicode issues: ${issues.join('; ')}`,
                evidence,
                severity: allPassed ? undefined : 'low',
              };
        },
      },
      {
        id: 'INPUT-005',
        name: 'Type Confusion Input',
        category: 'input',
        description: 'Test with incorrect data types in form fields',
        execute: async (page: Page): Promise<TestResult> => {
          const target = await findSearchTarget(page);
              if (!target) return skipNoTarget('INPUT-005');
              const { searchBox } = target;

              const typeConfusionTests = [
                '1234567890',
                'test@test.com',
                '2024-01-01',
                'true',
                'null',
                'undefined',
                'NaN',
                'Infinity',
                '-1',
                '0',
              ];

              const evidence: string[] = [];
              let allPassed = true;
              const issues: string[] = [];

              for (const test of typeConfusionTests) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(test);
                  await submitSearch(target);
                  await page.waitForTimeout(2000);

                  const screenshotPath = `evidence/type-confusion-${Date.now()}.png`;
                  await page.screenshot({ path: screenshotPath });
                  evidence.push(screenshotPath);

                  await page.goBack();
                  await page.waitForTimeout(1000);
                } catch (e) {
                  allPassed = false;
                  issues.push(`Exception with: ${test}`);
                }
              }

              return {
                testCaseId: 'INPUT-005',
                status: allPassed ? 'pass' : 'fail',
                message: allPassed
                  ? `Type confusion handled gracefully (${typeConfusionTests.length} types tested)`
                  : `Type confusion issues: ${issues.join('; ')}`,
                evidence,
                severity: allPassed ? undefined : 'low',
              };
        },
      },
    ],
  };
}

// ============================================================
// IMPROVED RESPONSIVE TEST SUITE
// ============================================================
export function createResponsiveTestSuite(): TestSuite {
  return {
    name: 'Responsive Tests',
    testCases: [
      {
        id: 'RESP-001',
        name: 'Mobile Viewport (375px)',
        category: 'responsive',
        description: 'Test layout at mobile viewport width',
        execute: async (page: Page): Promise<TestResult> => {
          await page.setViewportSize({ width: 375, height: 812 });
          await page.waitForTimeout(1000);

          const evidence: string[] = [];
          const screenshotPath = `evidence/responsive-mobile-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          // Check for horizontal overflow
          const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          // Check for elements outside viewport
          const outsideElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            let count = 0;
            elements.forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.left < -10 || rect.right > window.innerWidth + 10) {
                count++;
              }
            });
            return count;
          });

          // Check for viewport meta tag
          const hasViewportMeta = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="viewport"]');
            return meta !== null;
          });

          return {
            testCaseId: 'RESP-001',
            status: hasOverflow || outsideElements > 10 ? 'fail' : 'pass',
            message: hasOverflow
              ? `Horizontal overflow detected on mobile (${outsideElements} elements outside viewport)`
              : outsideElements > 10
              ? `${outsideElements} elements outside viewport`
              : 'Mobile layout looks good',
            evidence,
            severity: hasOverflow ? 'medium' : undefined,
            details: { hasOverflow, outsideElements, hasViewportMeta },
          };
        },
      },
      {
        id: 'RESP-002',
        name: 'Tablet Viewport (768px)',
        category: 'responsive',
        description: 'Test layout at tablet viewport width',
        execute: async (page: Page): Promise<TestResult> => {
          await page.setViewportSize({ width: 768, height: 1024 });
          await page.waitForTimeout(1000);

          const evidence: string[] = [];
          const screenshotPath = `evidence/responsive-tablet-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          const outsideElements = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            let count = 0;
            elements.forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.left < -10 || rect.right > window.innerWidth + 10) {
                count++;
              }
            });
            return count;
          });

          return {
            testCaseId: 'RESP-002',
            status: hasOverflow || outsideElements > 10 ? 'fail' : 'pass',
            message: hasOverflow
              ? `Horizontal overflow detected on tablet (${outsideElements} elements outside viewport)`
              : outsideElements > 10
              ? `${outsideElements} elements outside viewport`
              : 'Tablet layout looks good',
            evidence,
            severity: hasOverflow ? 'medium' : undefined,
            details: { hasOverflow, outsideElements },
          };
        },
      },
      {
        id: 'RESP-003',
        name: 'Desktop Viewport (1920px)',
        category: 'responsive',
        description: 'Test layout at desktop viewport width',
        execute: async (page: Page): Promise<TestResult> => {
          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.waitForTimeout(1000);

          const evidence: string[] = [];
          const screenshotPath = `evidence/responsive-desktop-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          return {
            testCaseId: 'RESP-003',
            status: hasOverflow ? 'fail' : 'pass',
            message: hasOverflow ? 'Horizontal overflow detected on desktop' : 'Desktop layout looks good',
            evidence,
            severity: hasOverflow ? 'low' : undefined,
            details: { hasOverflow },
          };
        },
      },
    ],
  };
}

// ============================================================
// IMPROVED ACCESSIBILITY TEST SUITE
// ============================================================
export function createAccessibilityTestSuite(): TestSuite {
  return {
    name: 'Accessibility Tests',
    testCases: [
      {
        id: 'A11Y-001',
        name: 'Images Without Alt Text',
        category: 'accessibility',
        description: 'Check for visible images missing alt text',
        execute: async (page: Page): Promise<TestResult> => {
          // Only count visible images
          const imageData = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            let totalVisible = 0;
            let missingAlt = 0;
            
            images.forEach(img => {
              // Check if image is visible
              const rect = img.getBoundingClientRect();
              const style = window.getComputedStyle(img);
              const isVisible = rect.width > 0 && 
                               rect.height > 0 && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               style.opacity !== '0';
              
              if (isVisible) {
                totalVisible++;
                if (!img.alt || img.alt.trim() === '') {
                  missingAlt++;
                }
              }
            });
            
            return { totalVisible, missingAlt };
          });

          const evidence: string[] = [];
          const screenshotPath = `evidence/a11y-images-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          const percentage = imageData.totalVisible > 0 
            ? (imageData.missingAlt / imageData.totalVisible) * 100 
            : 0;

          return {
            testCaseId: 'A11Y-001',
            status: imageData.missingAlt > 0 ? 'fail' : 'pass',
            message: imageData.missingAlt > 0
              ? `${imageData.missingAlt}/${imageData.totalVisible} visible images (${percentage.toFixed(1)}%) missing alt text`
              : 'All visible images have alt text',
            evidence,
            severity: imageData.missingAlt > 5 ? 'medium' : 'low',
            details: imageData,
          };
        },
      },
      {
        id: 'A11Y-002',
        name: 'Form Inputs Without Labels',
        category: 'accessibility',
        description: 'Check for visible form inputs missing associated labels',
        execute: async (page: Page): Promise<TestResult> => {
          // Only count visible inputs
          const inputData = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
            let totalVisible = 0;
            let missingLabels = 0;
            
            inputs.forEach(input => {
              // Check if input is visible
              const rect = input.getBoundingClientRect();
              const style = window.getComputedStyle(input);
              const isVisible = rect.width > 0 && 
                               rect.height > 0 && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               style.opacity !== '0' &&
                               (input as HTMLInputElement).type !== 'hidden';
              
              if (isVisible) {
                totalVisible++;
                const id = input.getAttribute('id');
                const ariaLabel = input.getAttribute('aria-label');
                const ariaLabelledBy = input.getAttribute('aria-labelledby');
                const label = id ? document.querySelector(`label[for="${id}"]`) : null;
                const hasPlaceholder = input.getAttribute('placeholder');
                
                // Consider input as labeled if it has any of these
                if (!label && !ariaLabel && !ariaLabelledBy && !hasPlaceholder) {
                  missingLabels++;
                }
              }
            });
            
            return { totalVisible, missingLabels };
          });

          const evidence: string[] = [];
          const screenshotPath = `evidence/a11y-labels-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          return {
            testCaseId: 'A11Y-002',
            status: inputData.missingLabels > 0 ? 'fail' : 'pass',
            message: inputData.missingLabels > 0
              ? `${inputData.missingLabels}/${inputData.totalVisible} visible form inputs missing labels`
              : 'All visible form inputs have labels',
            evidence,
            severity: inputData.missingLabels > 5 ? 'medium' : 'low',
            details: inputData,
          };
        },
      },
      {
        id: 'A11Y-003',
        name: 'Heading Hierarchy',
        category: 'accessibility',
        description: 'Check for proper heading hierarchy',
        execute: async (page: Page): Promise<TestResult> => {
          const headings = await page.evaluate(() => {
            const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            return Array.from(elements).map(el => ({
              level: parseInt(el.tagName[1]),
              text: el.textContent?.substring(0, 50) || '',
            }));
          });

          const evidence: string[] = [];
          const screenshotPath = `evidence/a11y-headings-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          // Check for h1
          const hasH1 = headings.some(h => h.level === 1);
          
          // Check for skipped levels
          let skippedLevels = false;
          let skippedAt = '';
          for (let i = 1; i < headings.length; i++) {
            if (headings[i].level > headings[i-1].level + 1) {
              skippedLevels = true;
              skippedAt = `H${headings[i-1].level} → H${headings[i].level}`;
              break;
            }
          }

          // Check for multiple H1s
          const h1Count = headings.filter(h => h.level === 1).length;
          const multipleH1s = h1Count > 1;

          return {
            testCaseId: 'A11Y-003',
            status: !hasH1 || skippedLevels || multipleH1s ? 'fail' : 'pass',
            message: !hasH1
              ? 'No H1 heading found'
              : multipleH1s
              ? `Multiple H1 headings found (${h1Count})`
              : skippedLevels
              ? `Heading hierarchy has skipped levels at ${skippedAt}`
              : 'Heading hierarchy looks good',
            evidence,
            severity: !hasH1 ? 'medium' : 'low',
            details: { headings: headings.slice(0, 10), hasH1, skippedLevels, multipleH1s },
          };
        },
      },
    ],
  };
}

// ============================================================
// IMPROVED NAVIGATION TEST SUITE
// ============================================================
export function createNavigationTestSuite(): TestSuite {
  return {
    name: 'Navigation Tests',
    testCases: [
      {
        id: 'NAV-001',
        name: 'Broken Links Check',
        category: 'navigation',
        description: 'Check for broken internal links with proper URL handling',
        execute: async (page: Page): Promise<TestResult> => {
          const currentUrl = page.url();
          const baseUrl = new URL(currentUrl).origin;

          // Get all visible links
          const links = await page.evaluate((base: string) => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map(a => ({
                href: a.getAttribute('href'),
                text: a.textContent?.substring(0, 50) || '',
                visible: a.getBoundingClientRect().width > 0,
              }))
              .filter(l => {
                if (!l.href || !l.visible) return false;
                // Skip anchor links, javascript:, mailto:, tel:
                if (l.href.startsWith('#') || l.href.startsWith('javascript:') || 
                    l.href.startsWith('mailto:') || l.href.startsWith('tel:')) return false;
                // Skip non-HTTP links
                if (l.href.startsWith('data:') || l.href.startsWith('blob:')) return false;
                return true;
              })
              .slice(0, 30); // Limit to first 30 visible links
          }, baseUrl);

          const evidence: string[] = [];
          let brokenLinks = 0;
          const brokenDetails: string[] = [];

          for (const link of links) {
            try {
              if (!link.href) continue;

              // Resolve relative URLs
              let fullUrl = link.href;
              if (fullUrl.startsWith('/')) {
                fullUrl = baseUrl + fullUrl;
              } else if (!fullUrl.startsWith('http')) {
                fullUrl = baseUrl + '/' + fullUrl;
              }

              // Skip external links (different domain)
              try {
                const linkDomain = new URL(fullUrl).origin;
                if (linkDomain !== baseUrl) continue;
              } catch {
                continue;
              }

              const response = await page.evaluate(async (url: string) => {
                try {
                  const res = await fetch(url, { 
                    method: 'GET',
                    credentials: 'same-origin',
                  });
                  return res.status;
                } catch {
                  return 0;
                }
              }, fullUrl);

              if (response === 0 || response >= 400) {
                brokenLinks++;
                brokenDetails.push(`${link.href} (${response})`);
              }
            } catch {
              brokenLinks++;
            }
          }

          const screenshotPath = `evidence/nav-links-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          return {
            testCaseId: 'NAV-001',
            status: brokenLinks > 0 ? 'fail' : 'pass',
            message: brokenLinks > 0
              ? `${brokenLinks}/${links.length} internal links broken: ${brokenDetails.slice(0, 5).join(', ')}`
              : `All ${links.length} internal links working`,
            evidence,
            severity: brokenLinks > 3 ? 'medium' : 'low',
            details: { totalChecked: links.length, brokenLinks, brokenDetails },
          };
        },
      },
      {
        id: 'NAV-002',
        name: 'JavaScript Console Errors',
        category: 'navigation',
        description: 'Check for JavaScript errors in console',
        execute: async (page: Page): Promise<TestResult> => {
          const errors: string[] = [];
          const warnings: string[] = [];

          page.on('console', msg => {
            if (msg.type() === 'error') {
              errors.push(msg.text());
            } else if (msg.type() === 'warning') {
              warnings.push(msg.text());
            }
          });

          page.on('pageerror', error => {
            errors.push(error.message);
          });

          // Reload page to capture errors
          await page.reload();
          await page.waitForTimeout(3000);

          const evidence: string[] = [];
          const screenshotPath = `evidence/nav-console-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          evidence.push(screenshotPath);

          return {
            testCaseId: 'NAV-002',
            status: errors.length > 0 ? 'fail' : 'pass',
            message: errors.length > 0
              ? `${errors.length} console errors, ${warnings.length} warnings`
              : `No console errors (${warnings.length} warnings)`,
            evidence,
            severity: errors.length > 0 ? 'medium' : undefined,
            details: { errors: errors.slice(0, 5), warnings: warnings.slice(0, 5) },
          };
        },
      },
    ],
  };
}

// ============================================================
// OVERLAY SUITE (OV invariants, see references/invariants/overlay-dialog.md)
// ============================================================
const OV_SEVERITY: Record<string, 'high' | 'medium'> = {
  OV3: 'high', OV4: 'high', OV7: 'high',
};
const SEV_RANK = { low: 0, medium: 1, high: 2, critical: 3 } as const;

export function createOverlaySuite(): TestSuite {
  return {
    name: 'Overlay Invariant Tests',
    testCases: [
      {
        id: 'OVL-001',
        name: 'Dialog invariants (OV1-OV4, OV6, OV7, OV10)',
        category: 'accessibility',
        description: 'Detect dialog triggers from the DOM and run the overlay invariants on each',
        execute: async (page: Page): Promise<TestResult> => {
          const overlays = await discoverOverlays(page);
          if (overlays.length === 0) {
            return {
              testCaseId: 'OVL-001',
              status: 'warning',
              message: 'No dialog triggers detected (role=dialog / aria-modal / modal triggers); overlay checks skipped',
              evidence: [],
            };
          }
          const perDialog: Array<{ trigger: string; results: InvariantResult[] }> = [];
          for (const o of overlays) {
            const results = await runOverlayInvariants(page, {
              trigger: page.locator(o.triggerSelector).first(),
              dialog: page.locator(o.dialogSelector).first(),
              close: o.closeSelector ? page.locator(o.closeSelector).first() : undefined,
            });
            perDialog.push({ trigger: o.triggerLabel, results });
          }
          const failedIds = new Set<string>();
          let severity: keyof typeof SEV_RANK = 'low';
          for (const d of perDialog) {
            for (const r of d.results) {
              if (r.pass) continue;
              failedIds.add(r.id);
              const sev = OV_SEVERITY[r.id.replace('-restore', '')] ?? 'medium';
              if (SEV_RANK[sev] > SEV_RANK[severity]) severity = sev;
            }
          }
          const table = perDialog.map(d => ({
            trigger: d.trigger,
            results: Object.fromEntries(d.results.map(r => [r.id, r.pass ? 'pass' : 'fail'])),
            failures: d.results.filter(r => !r.pass).map(r => `${r.id}: ${r.detail ?? ''}`),
          }));
          if (failedIds.size === 0) {
            return {
              testCaseId: 'OVL-001',
              status: 'pass',
              message: `${overlays.length} dialog(s) passed all automated overlay invariants`,
              evidence: [],
              details: table,
            };
          }
          return {
            testCaseId: 'OVL-001',
            status: 'fail',
            severity,
            message: `${overlays.length} dialog(s) tested; violated: ${[...failedIds].sort().join(', ')}`,
            evidence: [],
            details: table,
          };
        },
      },
    ],
  };
}

// ============================================================
// API SUITE (replay of the app's own 2xx writes; run-created only)
// ============================================================
const NO_AUTH_STRIP = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'x-auth-token', 'x-access-token']);
const REPLAY_DROP = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie']);
const MAX_REPLAYS = 10;

function hasTestMarker(rec: NetworkRecord): boolean {
  return !!rec.postData && rec.postData.includes('TEST_');
}

function hasCredentials(rec: NetworkRecord): boolean {
  return Object.keys(rec.headers).some(k => NO_AUTH_STRIP.has(k.toLowerCase()));
}

function sameOrigin(url: string, origin: string): boolean {
  try { return new URL(url).origin === origin; } catch { return false; }
}

interface Eligibility {
  eligible: NetworkRecord[];
  refused: Array<{ method: string; url: string; reason: string }>;
}

// Only same-origin writes that were made while the agent was acting, or whose
// payload carries a TEST_ marker, may be replayed. Everything else is refused.
function classify(log: NetworkRecord[], origin: string): Eligibility {
  const seen = new Set<string>();
  const eligible: NetworkRecord[] = [];
  const refused: Eligibility['refused'] = [];
  for (const rec of log) {
    const key = `${rec.method} ${rec.url} ${rec.postData ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const safeUrl = rec.url.split('?')[0];
    if (!sameOrigin(rec.url, origin)) {
      refused.push({ method: rec.method, url: safeUrl, reason: 'not the target origin' });
    } else if (rec.phase !== 'run' && !hasTestMarker(rec)) {
      refused.push({ method: rec.method, url: safeUrl, reason: 'not created by this run (no TEST_ marker, made during page load)' });
    } else if (eligible.length >= MAX_REPLAYS) {
      refused.push({ method: rec.method, url: safeUrl, reason: `replay cap (${MAX_REPLAYS}) reached` });
    } else {
      eligible.push(rec);
    }
  }
  return { eligible, refused };
}

function replayHeaders(rec: NetworkRecord, stripAuth: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec.headers)) {
    const lk = k.toLowerCase();
    if (REPLAY_DROP.has(lk) || lk.startsWith(':')) continue;
    if (stripAuth && NO_AUTH_STRIP.has(lk)) continue;
    out[k] = v;
  }
  return out;
}

export function createApiSuite(
  getLog: () => Promise<NetworkRecord[]>,
  targetUrl: string,
): TestSuite {
  let origin = '';
  try { origin = new URL(targetUrl).origin; } catch { /* leave empty: nothing is same-origin */ }
  const label = (r: { method: string; url: string }) => `${r.method} ${r.url.split('?')[0]}`;

  return {
    name: 'API Write Tests',
    testCases: [
      {
        id: 'API-001',
        name: 'Duplicate write replay',
        category: 'security',
        description: 'Replay run-created 2xx writes once to observe duplicate-write behavior',
        execute: async (page: Page): Promise<TestResult> => {
          const { eligible, refused } = classify(await getLog(), origin);
          if (eligible.length === 0) {
            return {
              testCaseId: 'API-001', status: 'warning', evidence: [],
              message: `No replayable writes (captured but refused: ${refused.length}); nothing was replayed`,
              details: { refused },
            };
          }
          const rows: Array<Record<string, unknown>> = [];
          let dupAccepted = 0, serverErrors = 0;
          for (const rec of eligible) {
            try {
              const res = await page.context().request.fetch(rec.url, {
                method: rec.method, headers: replayHeaders(rec, false),
                data: rec.postData ?? undefined, failOnStatusCode: false, timeout: 15000,
              });
              const s = res.status();
              const ok = s >= 200 && s < 300;
              const creating = rec.method === 'POST' || rec.method === 'PATCH';
              if (s >= 500) serverErrors++;
              else if (ok && creating) dupAccepted++;
              rows.push({ request: label(rec), originalStatus: rec.status, replayStatus: s,
                verdict: s >= 500 ? 'server error' : ok && creating ? 'duplicate accepted' : 'ok' });
            } catch (e) {
              rows.push({ request: label(rec), error: (e as Error).message });
            }
          }
          const status = serverErrors > 0 ? 'fail' : dupAccepted > 0 ? 'warning' : 'pass';
          return {
            testCaseId: 'API-001', status,
            severity: serverErrors > 0 ? 'high' : dupAccepted > 0 ? 'medium' : undefined,
            message: `${eligible.length} write(s) replayed once; duplicate accepted: ${dupAccepted}, server errors: ${serverErrors}`,
            evidence: [], details: { replays: rows, refused },
          };
        },
      },
      {
        id: 'API-002',
        name: 'Write without credentials',
        category: 'security',
        description: 'Replay run-created 2xx writes without auth headers/cookies',
        execute: async (_page: Page): Promise<TestResult> => {
          const { eligible, refused } = classify(await getLog(), origin);
          const candidates = eligible.filter(hasCredentials);
          if (candidates.length === 0) {
            return {
              testCaseId: 'API-002', status: 'warning', evidence: [],
              message: eligible.length === 0
                ? `No replayable writes (refused: ${refused.length}); nothing was replayed`
                : 'Eligible writes carried no auth headers; authorization replay not applicable',
              details: { refused },
            };
          }
          const anon = await playwrightRequest.newContext();
          const rows: Array<Record<string, unknown>> = [];
          let accepted = 0;
          try {
            for (const rec of candidates) {
              try {
                const res = await anon.fetch(rec.url, {
                  method: rec.method, headers: replayHeaders(rec, true),
                  data: rec.postData ?? undefined, failOnStatusCode: false, timeout: 15000,
                });
                const s = res.status();
                const ok = s >= 200 && s < 300;
                if (ok) accepted++;
                rows.push({ request: label(rec), replayStatus: s, verdict: ok ? 'ACCEPTED WITHOUT CREDENTIALS' : 'rejected' });
              } catch (e) {
                rows.push({ request: label(rec), error: (e as Error).message });
              }
            }
          } finally {
            await anon.dispose();
          }
          return {
            testCaseId: 'API-002',
            status: accepted > 0 ? 'fail' : 'pass',
            severity: accepted > 0 ? 'critical' : undefined,
            message: `${candidates.length} write(s) replayed without credentials; accepted: ${accepted}`,
            evidence: [], details: { replays: rows, refused },
          };
        },
      },
      {
        id: 'API-003',
        name: 'Replay eligibility summary',
        category: 'security',
        description: 'Report what was captured and what was refused (only run-created writes are replayed)',
        execute: async (_page: Page): Promise<TestResult> => {
          const log = await getLog();
          const { eligible, refused } = classify(log, origin);
          return {
            testCaseId: 'API-003', status: 'pass', evidence: [],
            message: `Captured ${log.length} 2xx write(s); replay-eligible: ${eligible.length}; refused: ${refused.length}`,
            details: { eligible: eligible.map(label), refused },
          };
        },
      },
    ],
  };
}

// ============================================================
// RAPID SUITE (repeated create/update/delete triggers; see lib/rapid.ts)
// ============================================================
export function createRapidSuite(maxClicks = 12): TestSuite {
  return {
    name: 'Rapid Action Tests',
    testCases: [
      {
        id: 'RPD-001',
        name: 'Rapid repeated mutating actions (duplicate request / guard / loading indicator)',
        category: 'security',
        description: 'Burst-click run-safe mutating triggers; count requests, sample guard and loading indicator',
        execute: (page: Page): Promise<TestResult> => runRapidSuite(page, { maxClicks }),
      },
    ],
  };
}
