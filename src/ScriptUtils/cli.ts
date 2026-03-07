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
 * Represents a CLI command argument definition.
 */
interface CliCommandArgument {
  description: string;
  name: string;
}

/**
 * Abstract base class for CLI commands. Each command encapsulates its own
 * name, description, optional arguments, and execution logic.
 */
abstract class CliCommand {
  public readonly arguments: CliCommandArgument[] = [];
  public abstract readonly description: string;
  public abstract readonly name: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Commander passes `any` typed arguments.
  public abstract execute(...args: any[]): Promisable<MaybeReturn<CliTaskResult>>;
}

class BuildCleanCommand extends CliCommand {
  public readonly description = 'Clean the dist folder';
  public readonly name = 'build:clean';

  public execute(): Promise<void> {
    return buildClean();
  }
}

class BuildCommand extends CliCommand {
  public readonly description = 'Build the plugin';
  public readonly name = 'build';

  public execute(): Promise<CliTaskResult> {
    return buildObsidianPlugin({ mode: BuildMode.Production });
  }
}

class BuildCompileCommand extends CliCommand {
  public readonly description = 'Check if code compiles';
  public readonly name = 'build:compile';

  public execute(): Promise<void> {
    return buildCompile();
  }
}

class BuildCompileSvelteCommand extends CliCommand {
  public readonly description = 'Check if Svelte code compiles';
  public readonly name = 'build:compile:svelte';

  public execute(): Promise<void> {
    return buildCompileSvelte();
  }
}

class BuildCompileTypeScriptCommand extends CliCommand {
  public readonly description = 'Check if TypeScript code compiles';
  public readonly name = 'build:compile:typescript';

  public execute(): Promise<void> {
    return buildCompileTypeScript();
  }
}

class BuildStaticCommand extends CliCommand {
  public readonly description = 'Copy static content to dist';
  public readonly name = 'build:static';

  public execute(): Promise<void> {
    return buildStatic();
  }
}

class DevCommand extends CliCommand {
  public readonly description = 'Build the plugin in development mode';
  public readonly name = 'dev';

  public execute(): Promise<CliTaskResult> {
    return buildObsidianPlugin({ mode: BuildMode.Development });
  }
}

class FormatCheckCommand extends CliCommand {
  public readonly description = 'Check if the source code is formatted';
  public readonly name = 'format:check';

  public execute(): Promise<void> {
    return format(false);
  }
}

class FormatCommand extends CliCommand {
  public readonly description = 'Format the source code';
  public readonly name = 'format';

  public execute(): Promise<void> {
    return format();
  }
}

class LintCommand extends CliCommand {
  public readonly description = 'Lint the source code';
  public readonly name = 'lint';

  public execute(): Promise<void> {
    return lint();
  }
}

class LintFixCommand extends CliCommand {
  public readonly description = 'Lint the source code and apply automatic fixes';
  public readonly name = 'lint:fix';

  public execute(): Promise<void> {
    return lint(true);
  }
}

class LintMarkdownCommand extends CliCommand {
  public readonly description = 'Lint the markdown documentation';
  public readonly name = 'lint:md';

  public execute(): Promise<void> {
    return lintMarkdown();
  }
}

class LintMarkdownFixCommand extends CliCommand {
  public readonly description = 'Lint the markdown documentation and apply automatic fixes';
  public readonly name = 'lint:md:fix';

  public execute(): Promise<void> {
    return lintMarkdown(true);
  }
}

class PublishCommand extends CliCommand {
  public override readonly arguments = [{ description: 'Publish to NPM beta', name: '[isBeta]' }];
  public readonly description = 'Publish to NPM';
  public readonly name = 'publish';

  public execute(isBeta: boolean): Promise<void> {
    return publish(isBeta);
  }
}

class SpellcheckCommand extends CliCommand {
  public readonly description = 'Spellcheck the source code';
  public readonly name = 'spellcheck';

  public execute(): Promise<void> {
    return spellcheck();
  }
}

class TestCommand extends CliCommand {
  public readonly description = 'Run tests';
  public readonly name = 'test';

  public execute(): Promise<void> {
    return test();
  }
}

class TestCoverageCommand extends CliCommand {
  public readonly description = 'Run tests with coverage';
  public readonly name = 'test:coverage';

  public execute(): Promise<void> {
    return testCoverage();
  }
}

class TestWatchCommand extends CliCommand {
  public readonly description = 'Run tests in watch mode';
  public readonly name = 'test:watch';

  public execute(): Promise<void> {
    return testWatch();
  }
}

class VersionCommand extends CliCommand {
  public override readonly arguments = [{ description: 'Version update type: major, minor, patch, beta, or x.y.z[-suffix]', name: '[versionUpdateType]' }];
  public readonly description = 'Release a new version';
  public readonly name = 'version';

  public execute(versionUpdateType: string): Promise<void> {
    return updateVersion(versionUpdateType);
  }
}

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
