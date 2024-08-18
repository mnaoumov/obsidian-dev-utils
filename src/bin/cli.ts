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
 * ["node", "path/to/cli.cjs", ...actualArgs]
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

export function cli(argv: string[] = process.argv.slice(NODE_SCRIPT_ARGV_SKIP_COUNT)): void {
  invokeAsyncSafely(wrapCliTask(async () => {
    const npmPackage = await readNpmPackage(getDirname(import.meta.url));
    const program = new Command();

    program
      .name(npmPackage.name)
      .description("CLI to some obsidian-dev-utils commands")
      .version(npmPackage.version);

    addCommand(program, CommandNames.Build, "Build the plugin", () => buildObsidianPlugin({ mode: BuildMode.Production }));
    addCommand(program, CommandNames.BuildClean, "Cleans dist folder", () => buildClean());
    addCommand(program, CommandNames.BuildStatic, "Copies static content to dist", () => buildStatic());
    addCommand(program, CommandNames.Dev, "Build the plugin in development mode", () => buildObsidianPlugin({ mode: BuildMode.Development }));
    addCommand(program, CommandNames.Lint, "Lints the source code", () => lint());
    addCommand(program, CommandNames.LintFix, "Lints the source code and applies automatic fixes if possible", () => lint(true));
    addCommand(program, CommandNames.Spellcheck, "Spellcheck the source code", () => spellcheck());
    addCommand(program, CommandNames.Version, "Release new version", (versionUpdateType: string) => updateVersion(versionUpdateType))
      .argument("<versionUpdateType>", "Version update type: major, minor, patch, beta, or x.y.z[-suffix]");
    await program.parseAsync(argv, { from: "user" });
  }));
}

function addCommand<Args extends unknown[]>(program: Command, name: string, description: string, taskFn: (...args: Args) => MaybePromise<TaskResult | void>): Command {
  return program.command(name)
    .description(description)
    .action((...args: Args) => wrapCliTask(() => taskFn(...args)));
}

export async function wrapCliTask(taskFn: () => MaybePromise<TaskResult | void>): Promise<void> {
  const result = await getTaskResult(taskFn);
  result.exit();
}

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
