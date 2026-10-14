#!/usr/bin/env node

import { Command } from 'commander';
import { Orchestrator } from './orchestrator.js';

const program = new Command();

program
  .name('qa-bug-hunter')
  .description('Autonomous QA Testing Agent - Exploratory Testing Methodology')
  .version('1.0.0');

program
  .command('test')
  .description('Run QA tests on a target URL')
  .requiredOption('-u, --url <url>', 'Target URL to test')
  .option('-s, --suites <suites>', 'Test suites to run (comma-separated: security,input,responsive,accessibility,navigation,overlay,rapid,api,all; rapid is opt-in, not in all)', 'all')
  .option('-o, --output <dir>', 'Output directory for reports', './docs/qa-reports')
  .option('--headless', 'Run browser in headless mode (default: headed; headless automatically when CI or QA_HEADLESS=1 is set)', false)
  .option('--insecure', 'Disable browser web security (same-origin/site isolation). Opt-in; logs a warning', false)
  .option('--domain <name>', 'Domain pack name (default: auto-detect from packs dir; none if absent)')
  .option('--rapid-max-clicks <n>', 'Hard cap on rapid-suite click attempts per run', '12')
  .option('--repo <path>', 'Repo root used for domain pack marker detection (default: cwd)')
  .option('--timeout <ms>', 'Browser timeout in milliseconds', '60000')
  .action(async (options) => {
    const suites: string[] = options.suites.split(',').map((x: string) => x.trim()).filter(Boolean);
    // API-only runs need no visible browser window.
    const apiOnly = suites.length > 0 && suites.every(x => x === 'api');
    // Headed when someone is watching; headless for API-only, CI or QA_HEADLESS=1.
    const unattended = !!process.env.CI || process.env.QA_HEADLESS === '1';
    const headless = options.headless || apiOnly || unattended;
    console.log('='.repeat(60));
    console.log('🎯 QA Bug Hunter Agent');
    console.log('   Exploratory Testing Methodology');
    console.log('='.repeat(60));
    console.log(`Target: ${options.url}`);
    console.log(`Test Suites: ${options.suites}`);
    console.log(`Output: ${options.output}`);
    console.log(`Mode: ${headless ? (apiOnly ? 'Headless (API-only)' : 'Headless') : 'Headed (Full Screen)'}`);
    console.log('='.repeat(60));

    const orchestrator = new Orchestrator({
      url: options.url,
      browser: {
        headless,
        timeout: parseInt(options.timeout),
        insecure: Boolean(options.insecure),
      },
      report: {
        outputDir: options.output,
      },
      ticket: {
        outputDir: `${options.output}/tickets`,
      },
      testSuites: suites,
      domain: options.domain,
      repo: options.repo,
      rapidMaxClicks: Math.max(2, parseInt(options.rapidMaxClicks) || 12),
    });

    try {
      await orchestrator.run();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze DOM structure of a target URL')
  .requiredOption('-u, --url <url>', 'Target URL to analyze')
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    console.log('='.repeat(60));
    console.log('🔍 DOM Analyzer');
    console.log('='.repeat(60));
    console.log(`Target: ${options.url}`);
    console.log('='.repeat(60));

    const orchestrator = new Orchestrator({
      url: options.url,
      browser: {
        headless: options.headless || !!process.env.CI || process.env.QA_HEADLESS === '1',
      },
      report: {
        outputDir: './docs/analysis',
      },
      ticket: {
        outputDir: './docs/analysis/tickets',
      },
      testSuites: [], // No tests, just analysis
    });

    try {
      await orchestrator.run();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
