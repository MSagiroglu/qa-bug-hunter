import { Page } from 'playwright';
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
  status: 'pass' | 'fail' | 'warning';
  message: string;
  evidence: string[];
  severity?: 'critical' | 'high' | 'medium' | 'low';
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

              const searchBox = page.locator('#twotabsearchtextbox');
              const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'SEC-001',
                  status: 'warning',
                  message: 'Search box not found - skipping XSS test',
                  evidence: [],
                };
              }

              let xssDetected = false;
              const evidence: string[] = [];
              const xssIndicators: string[] = [];

              // Listen for dialogs (XSS indicator)
              page.on('dialog', async dialog => {
                xssDetected = true;
                xssIndicators.push(`Dialog appeared: ${dialog.message()}`);
                await dialog.dismiss();
              });

              for (const payload of payloads) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(payload);
                  await searchButton.click();
                  await page.waitForTimeout(2000);

                  // Check if payload appears in DOM (reflected XSS)
                  const payloadInDOM = await page.evaluate((p) => {
                    return document.body.innerHTML.includes(p);
                  }, payload);

                  // Check for script execution indicators
                  const scriptExecuted = await page.evaluate(() => {
                    return (window as any).__xss_executed === true;
                  });

                  if (payloadInDOM || scriptExecuted) {
                    xssDetected = true;
                    xssIndicators.push(`Payload reflected in DOM: ${payload.substring(0, 50)}`);
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

              return {
                testCaseId: 'SEC-001',
                status: xssDetected ? 'fail' : 'pass',
                message: xssDetected
                  ? `XSS vulnerability detected! ${xssIndicators.join('; ')}`
                  : `No XSS vulnerabilities found (${payloads.length} payloads tested)`,
                evidence,
                severity: xssDetected ? 'critical' : undefined,
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

              const searchBox = page.locator('#twotabsearchtextbox');
              const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'SEC-002',
                  status: 'warning',
                  message: 'Search box not found - skipping SQL injection test',
                  evidence: [],
                };
              }

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
                  await searchButton.click();
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

              const searchBox = page.locator('#twotabsearchtextbox');
              const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'SEC-003',
                  status: 'warning',
                  message: 'Search box not found - skipping HTML injection test',
                  evidence: [],
                };
              }

              const evidence: string[] = [];
              let htmlInjected = false;
              const injectionIndicators: string[] = [];

              for (const payload of payloads) {
                try {
                  await searchBox.fill('');
                  await searchBox.fill(payload);
                  await searchButton.click();
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
          const searchBox = page.locator('#twotabsearchtextbox');
          const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible()) || !(await searchButton.isVisible())) {
                return {
                  testCaseId: 'INPUT-001',
                  status: 'warning',
                  message: 'Search box or button not found',
                  evidence: [],
                };
              }

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
              await searchButton.click();
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
          const searchBox = page.locator('#twotabsearchtextbox');
          const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'INPUT-002',
                  status: 'warning',
                  message: 'Search box not found',
                  evidence: [],
                };
              }

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
                  await searchButton.click();
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
          const searchBox = page.locator('#twotabsearchtextbox');
          const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'INPUT-003',
                  status: 'warning',
                  message: 'Search box not found',
                  evidence: [],
                };
              }

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
                  await searchButton.click();
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
          const searchBox = page.locator('#twotabsearchtextbox');
          const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'INPUT-004',
                  status: 'warning',
                  message: 'Search box not found',
                  evidence: [],
                };
              }

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
                  await searchButton.click();
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
          const searchBox = page.locator('#twotabsearchtextbox');
          const searchButton = page.locator('#nav-search-submit-button');

              if (!(await searchBox.isVisible())) {
                return {
                  testCaseId: 'INPUT-005',
                  status: 'warning',
                  message: 'Search box not found',
                  evidence: [],
                };
              }

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
                  await searchButton.click();
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
