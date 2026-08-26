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
  .option('-s, --suites <suites>', 'Test suites to run (comma-separated: security,input,responsive,accessibility,navigation,all)', 'all')
  .option('-o, --output <dir>', 'Output directory for reports', './docs/qa-reports')
  .option('--headless', 'Run browser in headless mode (default: headed)', false)
  .option('--timeout <ms>', 'Browser timeout in milliseconds', '60000')
  .action(async (options) => {
    console.log('='.repeat(60));
    console.log('🎯 QA Bug Hunter Agent');
    console.log('   Exploratory Testing Methodology');
    console.log('='.repeat(60));
    console.log(`Target: ${options.url}`);
    console.log(`Test Suites: ${options.suites}`);
    console.log(`Output: ${options.output}`);
    console.log(`Mode: ${options.headless ? 'Headless' : 'Headed (Full Screen)'}`);
    console.log('='.repeat(60));

    const orchestrator = new Orchestrator({
      url: options.url,
      browser: {
        headless: options.headless,
        timeout: parseInt(options.timeout),
      },
      report: {
        outputDir: options.output,
      },
      ticket: {
        outputDir: `${options.output}/tickets`,
      },
      testSuites: options.suites.split(','),
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
        headless: options.headless,
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
