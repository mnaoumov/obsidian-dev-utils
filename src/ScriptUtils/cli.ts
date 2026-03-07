/**
 * @packageDocumentation
 *
 * This module defines a CLI for managing various tasks related to Obsidian plugin development.
 * It leverages the `commander` library to define commands for building, linting, spellchecking,
 * and updating the version of the plugin. The CLI is designed to be flexible and can handle both
 * synchronous and asynchronous tasks.
 */

/* v8 ignore start -- CLI entry point using commander and dynamic jiti imports; requires a live process environment. */

import type { Promisable } from 'type-fest';

import { Command } from 'commander';

import type { MaybeReturn } from '../Type.ts';

import { invokeAsyncSafely } from '../Async.ts';
import { getFolderName } from '../Path.ts';
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
import { lintMarkdown } from './markdownlint/markdownlint.ts';
import { process } from './NodeModules.ts';
import { readPackageJson } from './Npm.ts';
import { publish } from './NpmPublish.ts';
import { spellcheck } from './spellcheck.ts';
import {
  test,
  testCoverage,
  testWatch
} from './test.ts';
import { updateVersion } from './version.ts';

/**
 * A number of leading arguments to skip when parsing command-line arguments.
 * First two elements typically represent the Node.js executable and the script path:
 * `["node", "path/to/cli.cjs", ...actualArgs]`
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

/**
 * Represents a self-contained CLI command definition.
 */
interface CliCommand {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander passes `any` typed arguments.
  action: (...args: any[]) => Promisable<MaybeReturn<CliTaskResult>>;
  arguments?: CliCommandArgument[];
  description: string;
  name: string;
}

/**
 * Represents a CLI command argument definition.
 */
interface CliCommandArgument {
  description: string;
  name: string;
}

/**
 * All available CLI commands.
 */
const commands: CliCommand[] = [
  { action: () => buildObsidianPlugin({ mode: BuildMode.Production }), description: 'Build the plugin', name: 'build' },
  { action: () => buildClean(), description: 'Clean the dist folder', name: 'build:clean' },
  { action: () => buildCompile(), description: 'Check if code compiles', name: 'build:compile' },
  { action: () => buildCompileSvelte(), description: 'Check if Svelte code compiles', name: 'build:compile:svelte' },
  { action: () => buildCompileTypeScript(), description: 'Check if TypeScript code compiles', name: 'build:compile:typescript' },
  { action: () => buildStatic(), description: 'Copy static content to dist', name: 'build:static' },
  { action: () => buildObsidianPlugin({ mode: BuildMode.Development }), description: 'Build the plugin in development mode', name: 'dev' },
  { action: () => format(), description: 'Format the source code', name: 'format' },
  { action: () => format(false), description: 'Check if the source code is formatted', name: 'format:check' },
  { action: () => lint(), description: 'Lint the source code', name: 'lint' },
  { action: () => lint(true), description: 'Lint the source code and apply automatic fixes', name: 'lint:fix' },
  { action: () => lintMarkdown(), description: 'Lint the markdown documentation', name: 'lint:md' },
  { action: () => lintMarkdown(true), description: 'Lint the markdown documentation and apply automatic fixes', name: 'lint:md:fix' },
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
