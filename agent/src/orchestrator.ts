import { BrowserManager, BrowserConfig } from './lib/browser.js';
import { DOMAnalyzer, DOMAnalysis } from './lib/analyzer.js';
import { 
  TestExecutor, 
  TestResult, 
  createSecurityTestSuite, 
  createInputTestSuite,
  createResponsiveTestSuite,
  createAccessibilityTestSuite,
  createNavigationTestSuite,
  createOverlaySuite,
  createApiSuite,
  createRapidSuite
} from './lib/executor.js';
import { Reporter, ReportConfig } from './lib/reporter.js';
import { TicketGenerator, TicketConfig, Ticket } from './lib/ticket.js';
import { resolveDomain } from './lib/domain.js';
import { EventEmitter } from 'events';

export interface OrchestratorConfig {
  url: string;
  browser: Partial<BrowserConfig>;
  report: Partial<ReportConfig>;
  ticket: Partial<TicketConfig>;
  testSuites: string[];
  /** Explicit domain pack name; undefined = auto-detect */
  domain?: string;
  /** Repo root used for pack marker detection (default: cwd) */
  repo?: string;
  /** Hard cap on rapid-suite click attempts for the whole run (default 12) */
  rapidMaxClicks?: number;
}

export interface OrchestratorEvents {
  'phase:started': (phase: string) => void;
  'phase:completed': (phase: string) => void;
  'analysis:completed': (analysis: DOMAnalysis) => void;
  'test:completed': (result: TestResult) => void;
  'report:generated': (path: string) => void;
  'tickets:generated': (tickets: Ticket[]) => void;
  'error': (error: Error) => void;
}

export class Orchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private browserManager: BrowserManager;
  private reporter: Reporter;
  private ticketGenerator: TicketGenerator;
  private domAnalysis: DOMAnalysis | null = null;
  private testResults: TestResult[] = [];
  private tickets: Ticket[] = [];
  private domainPack = 'none';

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.browserManager = new BrowserManager(config.browser);
    this.reporter = new Reporter(config.report);
    this.ticketGenerator = new TicketGenerator(config.ticket);
    const resolution = resolveDomain(config.domain, config.repo ?? process.cwd());
    this.domainPack = resolution.name;
    this.reporter.setMeta({
      mode: config.browser.headless ? 'Headless' : 'Headed (Full Screen)',
      lenses: this.getSelectedSuiteNames(),
      domainPack: resolution.name,
    });
  }

  async run(): Promise<{
    domAnalysis: DOMAnalysis;
    testResults: TestResult[];
    tickets: Ticket[];
    reportPath: string;
    videoPath: string | null;
  }> {
    const startTime = Date.now();
    let videoPath: string | null = null;

    try {
      // Phase 1: Launch Browser
      this.emit('phase:started', 'Browser Launch');
      console.log('\n🚀 Phase 1: Tarayıcı başlatılıyor...');
      await this.browserManager.launch();
      this.emit('phase:completed', 'Browser Launch');

      // Phase 2: Navigate and Analyze
      this.emit('phase:started', 'Navigation & Analysis');
      console.log('\n🔍 Phase 2: Sayfa analiz ediliyor...');
      const page = await this.browserManager.newPage();
      await this.browserManager.navigate(this.config.url);
      await this.browserManager.acceptCookies();

      const analyzer = new DOMAnalyzer(page);
      this.domAnalysis = await analyzer.analyze();
      this.emit('analysis:completed', this.domAnalysis);
      this.emit('phase:completed', 'Navigation & Analysis');

      // Phase 3: Execute Tests
      this.emit('phase:started', 'Test Execution');
      console.log('\n🧪 Phase 3: Testler çalıştırılıyor...');
      this.browserManager.phase = 'run';
      const executor = new TestExecutor(page);

      executor.on('test:completed', (result) => {
        this.emit('test:completed', result);
      });

      // Run selected test suites
      const testSuites = this.getSelectedTestSuites();
      for (const suite of testSuites) {
        executor.reset();
        const results = await executor.runTestSuite(suite);
        this.testResults.push(...results);
      }

      this.emit('phase:completed', 'Test Execution');

      // Phase 4: Generate Tickets
      this.emit('phase:started', 'Ticket Generation');
      console.log('\n🎫 Phase 4: Ticketlar oluşturuluyor...');
      this.tickets = await this.ticketGenerator.generateTickets(this.testResults);
      this.emit('tickets:generated', this.tickets);
      this.emit('phase:completed', 'Ticket Generation');

      // Phase 5: Generate Report
      this.emit('phase:started', 'Report Generation');
      console.log('\n📄 Phase 5: Rapor oluşturuluyor...');
      const executionTime = Date.now() - startTime;
      
      // Get video path
      videoPath = await this.browserManager.getVideoPath();
      
      const reportPath = await this.reporter.generateReport(
        this.config.url,
        this.domAnalysis,
        this.testResults,
        executionTime,
        videoPath
      );
      this.emit('report:generated', reportPath);
      this.emit('phase:completed', 'Report Generation');

      // Phase 6: Summary
      this.printSummary(executionTime, reportPath, videoPath);

      return {
        domAnalysis: this.domAnalysis,
        testResults: this.testResults,
        tickets: this.tickets,
        reportPath,
        videoPath,
      };

    } catch (error) {
      try {
        await this.reporter.generateFailureReport(this.config.url, error as Error);
      } catch {
        // reporting must not mask the original error
      }
      // An EventEmitter throws on 'error' without a listener; only emit when handled.
      if (this.listenerCount('error') > 0) this.emit('error', error as Error);
      throw error;
    } finally {
      await this.browserManager.close();
    }
  }

  private getSelectedSuiteNames(): string[] {
    const known = ['security', 'input', 'responsive', 'accessibility', 'navigation', 'overlay', 'rapid', 'api'];
    // rapid fires repeated mutating clicks, so it is opt-in and not part of 'all'.
    if (this.config.testSuites.includes('all')) return known.filter(n => n !== 'rapid');
    return known.filter(n => this.config.testSuites.includes(n));
  }

  private getSelectedTestSuites() {
    const allSuites = [
      { name: 'security', suite: () => createSecurityTestSuite() },
      { name: 'input', suite: () => createInputTestSuite() },
      { name: 'responsive', suite: () => createResponsiveTestSuite() },
      { name: 'accessibility', suite: () => createAccessibilityTestSuite() },
      { name: 'navigation', suite: () => createNavigationTestSuite() },
      { name: 'overlay', suite: () => createOverlaySuite() },
      { name: 'rapid', suite: () => createRapidSuite(this.config.rapidMaxClicks ?? 12) },
      // api last: it replays writes captured while the other suites ran
      { name: 'api', suite: () => createApiSuite(() => this.browserManager.getNetworkLog(), this.config.url) },
    ];
    const wanted = new Set(this.getSelectedSuiteNames());
    return allSuites.filter(s => wanted.has(s.name)).map(s => s.suite());
  }

  private printSummary(executionTime: number, reportPath: string, videoPath: string | null): void {
    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const warnings = this.testResults.filter(r => r.status === 'warning').length;
    const skipped = this.testResults.filter(r => r.status === 'skipped').length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📋 Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`🎫 Tickets Generated: ${this.tickets.length}`);
    console.log(`📄 Report: ${reportPath}`);
    if (videoPath) {
      console.log(`🎬 Video: ${videoPath}`);
    }
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`   - ${r.testCaseId}: ${r.message}`));
    }

    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.testResults
        .filter(r => r.status === 'warning')
        .forEach(r => console.log(`   - ${r.testCaseId}: ${r.message}`));
    }

    if (skipped > 0) {
      console.log('\nSKIPPED:');
      this.testResults
        .filter(r => r.status === 'skipped')
        .forEach(r => console.log(`   - ${r.testCaseId}: ${r.message}`));
    }

    console.log('\n✅ Testing completed successfully!');
  }

  getDomAnalysis(): DOMAnalysis | null {
    return this.domAnalysis;
  }

  getTestResults(): TestResult[] {
    return this.testResults;
  }

  getTickets(): Ticket[] {
    return this.tickets;
  }
}
