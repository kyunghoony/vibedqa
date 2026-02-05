import chalk from 'chalk';

let verboseMode = false;

export function setVerbose(v: boolean): void {
  verboseMode = v;
}

function ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export const log = {
  info(msg: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + msg);
  },

  success(msg: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.green(msg));
  },

  warn(msg: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.yellow(`⚠  ${msg}`));
  },

  error(msg: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.red(`🔴 ${msg}`));
  },

  action(msg: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.magenta(msg));
  },

  click(target: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.cyan(`🖱  CLICKING "${target}"...`));
  },

  input(target: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.cyan(`⌨  TYPING into "${target}"...`));
  },

  capture(filename: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.blue(`📸 CAPTURE: ${filename}`));
  },

  navigate(url: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.blue(`🔗 NAVIGATING to ${url}`));
  },

  stateChange(desc: string): void {
    console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.yellow(`▶ ${desc}`));
  },

  verbose(msg: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[${ts()}]`) + '  ' + chalk.dim(msg));
    }
  },

  banner(): void {
    console.log('');
    console.log(chalk.bold.magenta('🚀 VibedQA v0.1.0'));
    console.log('');
  },

  divider(): void {
    console.log(chalk.gray('━'.repeat(40)));
  },
};
