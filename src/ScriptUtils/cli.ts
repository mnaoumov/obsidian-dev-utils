/**
 * @packageDocumentation
 *
 * This module defines a CLI for managing various tasks related to Obsidian plugin development.
 * It leverages the `commander` library to define commands for building, linting, spellchecking,
 * and updating the version of the plugin. The CLI is designed to be flexible and can handle both
 * synchronous and asynchronous tasks.
 */

/* v8 ignore start -- CLI entry point using commander; requires a live process environment. */

import type { Promisable } from 'type-fest';

import { Command } from 'commander';

import type { MaybeReturn } from '../Type.ts';

import { invokeAsyncSafely } from '../Async.ts';
import { getFolderName } from '../Path.ts';
import {
  CliTaskResult,
  wrapCliTask
} from './CliUtils.ts';
import { build } from './commands/Build.ts';
import { buildClean } from './commands/BuildClean.ts';
import { buildCompile } from './commands/BuildCompile.ts';
import { buildCompileSvelte } from './commands/BuildCompileSvelte.ts';
import { buildCompileTypeScript } from './commands/BuildCompileTypeScript.ts';
import { buildStatic } from './commands/BuildStatic.ts';
import { dev } from './commands/Dev.ts';
import { format } from './commands/Format.ts';
import { formatCheck } from './commands/FormatCheck.ts';
import { lint } from './commands/Lint.ts';
import { lintFix } from './commands/LintFix.ts';
import { lintMarkdown } from './commands/LintMarkdown.ts';
import { lintMarkdownFix } from './commands/LintMarkdownFix.ts';
import { publish } from './commands/Publish.ts';
import { spellcheck } from './commands/Spellcheck.ts';
import { test } from './commands/Test.ts';
import { testCoverage } from './commands/TestCoverage.ts';
import { testWatch } from './commands/TestWatch.ts';
import { updateVersion } from './commands/Version.ts';
import { process } from './NodeModules.ts';
import { readPackageJson } from './Npm.ts';

/**
 * A number of leading arguments to skip when parsing command-line arguments.
 * First two elements typically represent the Node.js executable and the script path:
 * `["node", "path/to/cli.cjs", ...actualArgs]`
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

/**
 * Represents a CLI command definition.
 */
interface CliCommandDefinition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander passes `any` typed arguments.
  action: (...args: any[]) => Promisable<MaybeReturn<CliTaskResult>>;
  arguments?: { description: string; name: string }[];
  description: string;
  name: string;
}

/**
 * All available CLI commands.
 */
const commands: CliCommandDefinition[] = [
  { action: () => build(), description: 'Build the plugin', name: 'build' },
  { action: () => buildClean(), description: 'Clean the dist folder', name: 'build:clean' },
  { action: () => buildCompile(), description: 'Check if code compiles', name: 'build:compile' },
  { action: () => buildCompileSvelte(), description: 'Check if Svelte code compiles', name: 'build:compile:svelte' },
  { action: () => buildCompileTypeScript(), description: 'Check if TypeScript code compiles', name: 'build:compile:typescript' },
  { action: () => buildStatic(), description: 'Copy static content to dist', name: 'build:static' },
  { action: () => dev(), description: 'Build the plugin in development mode', name: 'dev' },
  { action: () => format(), description: 'Format the source code', name: 'format' },
  { action: () => formatCheck(), description: 'Check if the source code is formatted', name: 'format:check' },
  { action: () => lint(), description: 'Lint the source code', name: 'lint' },
  { action: () => lintFix(), description: 'Lint the source code and apply automatic fixes', name: 'lint:fix' },
  { action: () => lintMarkdown(), description: 'Lint the markdown documentation', name: 'lint:md' },
  { action: () => lintMarkdownFix(), description: 'Lint the markdown documentation and apply automatic fixes', name: 'lint:md:fix' },
  {
    action: (isBeta: boolean) => publish(isBeta),
    arguments: [{ description: 'Publish to NPM beta', name: '[isBeta]' }],
    description: 'Publish to NPM',
    name: 'publish'
  },
  { action: () => spellcheck(), description: 'Spellcheck the source code', name: 'spellcheck' },
  { action: () => test(), description: 'Run tests', name: 'test' },
  { action: () => testCoverage(), description: 'Run tests with coverage', name: 'test:coverage' },
  { action: () => testWatch(), description: 'Run tests in watch mode', name: 'test:watch' },
  {
    action: (versionUpdateType: string) => updateVersion(versionUpdateType),
    arguments: [{ description: 'Version update type: major, minor, patch, beta, or x.y.z[-suffix]', name: '[versionUpdateType]' }],
    description: 'Release a new version',
    name: 'version'
  }
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
          .action((...args: unknown[]) => wrapCliTask(async () => await command.action(...args)));

        for (const arg of command.arguments ?? []) {
          cmd.argument(arg.name, arg.description);
        }
      }

      await program.parseAsync(argv, { from: 'user' });
      return CliTaskResult.DoNotExit();
    })
  );
}

/* v8 ignore stop */
