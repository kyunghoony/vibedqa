#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { DEFAULT_CONFIG, DEFAULT_VIEWPORTS } from './config.js';
import { runPipeline } from './index.js';
import { setVerbose, log } from './utils/logger.js';
import type { ScanConfig } from './types.js';

const program = new Command();

program
  .name('vibedqa')
  .description('AI-powered visual QA that clicks through your app like a real user')
  .version('0.1.0')
  .requiredOption('--url <url>', 'URL to test')
  .option('--lang <langs>', 'Languages to test (comma-separated)', 'auto')
  .option('--theme <themes>', 'Themes to test (comma-separated)', 'light')
  .option('--viewport <viewports>', 'Viewports (comma-separated: desktop,mobile)', 'desktop')
  .option('--depth <n>', 'Max navigation depth', '3')
  .option('--output <dir>', 'Report output directory', DEFAULT_CONFIG.outputDir)
  .option('--ai-model <model>', 'AI model (gemini)', 'gemini')
  .option('--no-click', 'Disable click exploration')
  .option('--no-input', 'Disable form auto-fill')
  .option('--no-navigate', 'Disable link navigation')
  .option('--max-clicks <n>', 'Max clicks per page', '50')
  .option('--timeout <ms>', 'Page load timeout in ms', '30000')
  .option('--verbose', 'Verbose logging', false)
  .action(async (opts) => {
    const config: ScanConfig = {
      url: opts.url,
      languages: opts.lang.split(',').map((s: string) => s.trim()),
      themes: opts.theme.split(',').map((s: string) => s.trim()),
      viewports: opts.viewport
        .split(',')
        .map((s: string) => s.trim())
        .map((name: string) => DEFAULT_VIEWPORTS[name] || DEFAULT_VIEWPORTS.desktop),
      maxDepth: parseInt(opts.depth, 10),
      maxClicksPerPage: parseInt(opts.maxClicks, 10),
      timeout: parseInt(opts.timeout, 10),
      enableClick: opts.click !== false,
      enableInput: opts.input !== false,
      enableNavigation: opts.navigate !== false,
      outputDir: opts.output,
      aiModel: opts.aiModel,
      verbose: opts.verbose,
    };

    setVerbose(config.verbose);

    try {
      await runPipeline(config);
    } catch (err) {
      log.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
