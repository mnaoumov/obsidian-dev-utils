/**
 * @fileoverview
 * This module defines a CLI for managing various tasks related to Obsidian plugin development.
 * It leverages the `commander` library to define commands for building, linting, spellchecking,
 * and updating the version of the plugin. The CLI is designed to be flexible and can handle both
 * synchronous and asynchronous tasks.
 */

import { Command } from "commander";
import {
  BuildMode,
  buildObsidianPlugin
} from "./esbuild/ObsidianPluginBuilder.ts";
import process from "node:process";
import { lint } from "./ESLint/ESLint.ts";
import { spellcheck } from "./spellcheck.ts";
import { updateVersion } from "./version.ts";
import {
  invokeAsyncSafely,
  type MaybePromise
} from "../Async.ts";
import {
  getTaskResult,
  TaskResult
} from "../TaskResult.ts";
import { readNpmPackage } from "../Npm.ts";
import { getDirname } from "../Path.ts";
import {
  buildClean,
  buildStatic
} from "./build.ts";

/**
 * The number of leading arguments to skip when parsing command-line arguments.
 * The first two elements typically represent the Node.js executable and the script path:
 * `["node", "path/to/cli.cjs", ...actualArgs]`
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

/**
 * Main function to run the CLI. It sets up the commands using the `commander` library and
 * handles the execution of tasks like building, cleaning, linting, spellchecking, and versioning.
 *
 * @param argv - The command-line arguments to parse. Defaults to `process.argv` minus the first two elements.
 */
export function cli(argv: string[] = process.argv.slice(NODE_SCRIPT_ARGV_SKIP_COUNT)): void {
  invokeAsyncSafely(wrapCliTask(async () => {
    const npmPackage = await readNpmPackage(getDirname(import.meta.url));
    const program = new Command();

    program
      .name(npmPackage.name)
      .description("CLI for Obsidian plugin development utilities")
      .version(npmPackage.version);

    addCommand(program, CommandNames.Build, "Build the plugin", () => buildObsidianPlugin({ mode: BuildMode.Production }));
    addCommand(program, CommandNames.BuildClean, "Clean the dist folder", () => buildClean());
    addCommand(program, CommandNames.BuildStatic, "Copy static content to dist", () => buildStatic());
    addCommand(program, CommandNames.Dev, "Build the plugin in development mode", () => buildObsidianPlugin({ mode: BuildMode.Development }));
    addCommand(program, CommandNames.Lint, "Lint the source code", () => lint());
    addCommand(program, CommandNames.LintFix, "Lint the source code and apply automatic fixes", () => lint(true));
    addCommand(program, CommandNames.Spellcheck, "Spellcheck the source code", () => spellcheck());
    addCommand(program, CommandNames.Version, "Release a new version", (versionUpdateType: string) => updateVersion(versionUpdateType))
      .argument("<versionUpdateType>", "Version update type: major, minor, patch, beta, or x.y.z[-suffix]");
    await program.parseAsync(argv, { from: "user" });
  }));
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
function addCommand<Args extends unknown[]>(program: Command, name: string, description: string, taskFn: (...args: Args) => MaybePromise<TaskResult | void>): Command {
  return program.command(name)
    .description(description)
    .action((...args: Args) => wrapCliTask(() => taskFn(...args)));
}

/**
 * Wraps a CLI task function to ensure it runs safely and handles its `TaskResult`.
 *
 * @param taskFn - The task function to execute, which may return a `TaskResult` or void.
 * @returns A promise that resolves when the task is completed and exits with the appropriate status.
 */
export async function wrapCliTask(taskFn: () => MaybePromise<TaskResult | void>): Promise<void> {
  const result = await getTaskResult(taskFn);
  result.exit();
}

/**
 * Converts an array of command-line arguments into a single command-line string.
 * Handles escaping of special characters such as spaces, quotes, and newlines.
 *
 * @param args - The array of command-line arguments to convert.
 * @returns A string representing the command-line invocation.
 */
export function toCommandLine(args: string[]): string {
  return args
    .map(arg => {
      if (/[\s"\n]/.test(arg)) {
        const escapedArg = arg.replace(/"/g, "\\\"").replace(/\n/g, "\\n");
        return `"${escapedArg}"`;
      }
      return arg;
    })
    .join(" ");
}

/**
 * Enum representing the names of the commands available in the CLI.
 */
enum CommandNames {
  Build = "build",
  BuildClean = "build:clean",
  BuildStatic = "build:static",
  Dev = "dev",
  Lint = "lint",
  LintFix = "lint:fix",
  Spellcheck = "spellcheck",
  Version = "version"
}
