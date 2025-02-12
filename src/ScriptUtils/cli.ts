/**
 * @packageDocumentation cli
 * This module defines a CLI for managing various tasks related to Obsidian plugin development.
 * It leverages the `commander` library to define commands for building, linting, spellchecking,
 * and updating the version of the plugin. The CLI is designed to be flexible and can handle both
 * synchronous and asynchronous tasks.
 */

import { Command } from 'commander';

import type { MaybePromise } from '../Async.ts';

import { invokeAsyncSafely } from '../Async.ts';
import { getDirname } from '../Path.ts';
import {
  buildClean,
  buildCompile,
  buildCompileSvelte,
  buildCompileTypeScript,
  buildStatic
} from './build.ts';
import {
  CliTaskResult,
  wrapCliTask
} from './CliUtils.ts';
import {
  BuildMode,
  buildObsidianPlugin
} from './esbuild/ObsidianPluginBuilder.ts';
import { lint } from './ESLint/ESLint.ts';
import { format } from './format.ts';
import { process } from './NodeModules.ts';
import { readPackageJson } from './Npm.ts';
import { publish } from './NpmPublish.ts';
import { spellcheck } from './spellcheck.ts';
import { updateVersion } from './version.ts';
/**
 * The number of leading arguments to skip when parsing command-line arguments.
 * The first two elements typically represent the Node.js executable and the script path:
 * `["node", "path/to/cli.cjs", ...actualArgs]`
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

/**
 * Enum representing the names of the commands available in the CLI.
 */
enum CommandNames {
  Build = 'build',
  BuildClean = 'build:clean',
  BuildCompile = 'build:compile',
  BuildCompileSvelte = 'build:compile:svelte',
  BuildCompileTypeScript = 'build:compile:typescript',
  BuildStatic = 'build:static',
  Dev = 'dev',
  Format = 'format',
  FormatCheck = 'format:check',
  Lint = 'lint',
  LintFix = 'lint:fix',
  Publish = 'publish',
  Spellcheck = 'spellcheck',
  Version = 'version'
}

/**
 * Main function to run the CLI. It sets up the commands using the `commander` library and
 * handles the execution of tasks like building, cleaning, linting, spellchecking, and versioning.
 *
 * @param argv - The command-line arguments to parse. Defaults to `process.argv` minus the first two elements.
 */
export function cli(argv: string[] = process.argv.slice(NODE_SCRIPT_ARGV_SKIP_COUNT)): void {
  invokeAsyncSafely(() =>
    wrapCliTask(async () => {
      const packageJson = await readPackageJson(getDirname(import.meta.url));
      const program = new Command();

      program
        .name(packageJson.name ?? '(unknown)')
        .description('CLI for Obsidian plugin development utilities')
        .version(packageJson.version ?? '(unknown)');

      addCommand(program, CommandNames.Build, 'Build the plugin', () => buildObsidianPlugin({ mode: BuildMode.Production }));
      addCommand(program, CommandNames.BuildClean, 'Clean the dist folder', () => buildClean());
      addCommand(program, CommandNames.BuildCompile, 'Check if code compiles', () => buildCompile());
      addCommand(program, CommandNames.BuildCompileSvelte, 'Check if Svelte code compiles', () => buildCompileSvelte());
      addCommand(program, CommandNames.BuildCompileTypeScript, 'Check if TypeScript code compiles', () => buildCompileTypeScript());
      addCommand(program, CommandNames.BuildStatic, 'Copy static content to dist', () => buildStatic());
      addCommand(program, CommandNames.Dev, 'Build the plugin in development mode', () => buildObsidianPlugin({ mode: BuildMode.Development }));
      addCommand(program, CommandNames.Format, 'Format the source code', () => format());
      addCommand(program, CommandNames.FormatCheck, 'Check if the source code is formatted', () => format(false));
      addCommand(program, CommandNames.Lint, 'Lint the source code', () => lint());
      addCommand(program, CommandNames.LintFix, 'Lint the source code and apply automatic fixes', () => lint(true));
      addCommand(program, CommandNames.Publish, 'Publish to NPM', (isBeta: boolean) => publish(isBeta))
        .argument('[isBeta]', 'Publish to NPM beta');
      addCommand(program, CommandNames.Spellcheck, 'Spellcheck the source code', () => spellcheck());
      addCommand(program, CommandNames.Version, 'Release a new version', (versionUpdateType: string) => updateVersion(versionUpdateType))
        .argument('[versionUpdateType]', 'Version update type: major, minor, patch, beta, or x.y.z[-suffix]');
      await program.parseAsync(argv, { from: 'user' });
      return CliTaskResult.DoNotExit();
    })
  );
}

/**
 * Adds a command to the CLI program with the specified name, description, and task function.
 *
 * @param program - The `commander` program instance to which the command is added.
 * @param name - The name of the command.
 * @param description - A brief description of what the command does.
 * @param taskFn - The function to execute when the command is invoked. Can return a `TaskResult` or void.
 * @returns The `commander` command instance for further chaining.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function addCommand<Args extends unknown[]>(
  program: Command,
  name: string,
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  taskFn: (...args: Args) => MaybePromise<CliTaskResult | void>
): Command {
  return program.command(name)
    .description(description)
    .action((...args: Args) => wrapCliTask(() => taskFn(...args)));
}
