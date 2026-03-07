/**
 * @packageDocumentation
 *
 * This module defines a CLI for managing various tasks related to Obsidian plugin development.
 * It leverages the `commander` library to define commands for building, linting, spellchecking,
 * and updating the version of the plugin. The CLI is designed to be flexible and can handle both
 * synchronous and asynchronous tasks.
 */

/* v8 ignore start -- CLI entry point using commander and dynamic jiti imports; requires a live process environment. */

import { Command } from 'commander';

import type { CliCommand } from './CliCommand.ts';

import { invokeAsyncSafely } from '../Async.ts';
import { getFolderName } from '../Path.ts';
import {
  CliTaskResult,
  wrapCliTask
} from './CliUtils.ts';
import { BuildCleanCommand } from './commands/BuildCleanCommand.ts';
import { BuildCommand } from './commands/BuildCommand.ts';
import { BuildCompileCommand } from './commands/BuildCompileCommand.ts';
import { BuildCompileSvelteCommand } from './commands/BuildCompileSvelteCommand.ts';
import { BuildCompileTypeScriptCommand } from './commands/BuildCompileTypeScriptCommand.ts';
import { BuildStaticCommand } from './commands/BuildStaticCommand.ts';
import { DevCommand } from './commands/DevCommand.ts';
import { FormatCheckCommand } from './commands/FormatCheckCommand.ts';
import { FormatCommand } from './commands/FormatCommand.ts';
import { LintCommand } from './commands/LintCommand.ts';
import { LintFixCommand } from './commands/LintFixCommand.ts';
import { LintMarkdownCommand } from './commands/LintMarkdownCommand.ts';
import { LintMarkdownFixCommand } from './commands/LintMarkdownFixCommand.ts';
import { PublishCommand } from './commands/PublishCommand.ts';
import { SpellcheckCommand } from './commands/SpellcheckCommand.ts';
import { TestCommand } from './commands/TestCommand.ts';
import { TestCoverageCommand } from './commands/TestCoverageCommand.ts';
import { TestWatchCommand } from './commands/TestWatchCommand.ts';
import { VersionCommand } from './commands/VersionCommand.ts';
import { process } from './NodeModules.ts';
import { readPackageJson } from './Npm.ts';

/**
 * A number of leading arguments to skip when parsing command-line arguments.
 * First two elements typically represent the Node.js executable and the script path:
 * `["node", "path/to/cli.cjs", ...actualArgs]`
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

/**
 * All available CLI commands.
 */
const commands: CliCommand[] = [
  new BuildCleanCommand(),
  new BuildCommand(),
  new BuildCompileCommand(),
  new BuildCompileSvelteCommand(),
  new BuildCompileTypeScriptCommand(),
  new BuildStaticCommand(),
  new DevCommand(),
  new FormatCheckCommand(),
  new FormatCommand(),
  new LintCommand(),
  new LintFixCommand(),
  new LintMarkdownCommand(),
  new LintMarkdownFixCommand(),
  new PublishCommand(),
  new SpellcheckCommand(),
  new TestCommand(),
  new TestCoverageCommand(),
  new TestWatchCommand(),
  new VersionCommand()
];

/**
 * Main function to run the CLI. It sets up the commands using the `commander` library and
 * handles the execution of tasks like building, cleaning, linting, spellchecking, and versioning.
 *
 * @param argv - The command-line arguments to parse. Defaults to `process.argv` minus the first two elements.
 */
export function cli(argv: string[] = process.argv.slice(NODE_SCRIPT_ARGV_SKIP_COUNT)): void {
  invokeAsyncSafely(() =>
    wrapCliTask(async () => {
      const packageJson = await readPackageJson(getFolderName(import.meta.url));
      const program = new Command();

      program
        .name(packageJson.name ?? '(unknown)')
        .description('CLI for Obsidian plugin development utilities')
        .version(packageJson.version ?? '(unknown)');

      for (const command of commands) {
        const cmd = program.command(command.name)
          .description(command.description)
          .action((...args: unknown[]) => wrapCliTask(async () => await command.execute(...args)));

        for (const arg of command.arguments) {
          cmd.argument(arg.name, arg.description);
        }
      }

      await program.parseAsync(argv, { from: 'user' });
      return CliTaskResult.DoNotExit();
    })
  );
}

/* v8 ignore stop */
