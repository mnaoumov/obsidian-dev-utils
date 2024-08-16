import { Command } from "commander";
import {
  BuildMode,
  buildObsidianPlugin
} from "./esbuild/ObsidianPluginBuilder.ts";
import process from "node:process";
import { lint } from "./ESLint/ESLint.ts";
import { spellcheck } from "./spellcheck.ts";
import { updateVersion } from "./version.ts";
import type { MaybePromise } from "../Async.ts";
import {
  getTaskResult,
  TaskResult
} from "../TaskResult.ts";

/**
 * The number of leading arguments to skip when parsing command-line arguments.
 * The first two elements typically represent the Node.js executable and the script path:
 * ["node", "path/to/cli.cjs", ...actualArgs]
 */
const NODE_SCRIPT_ARGV_SKIP_COUNT = 2;

export function cli(argv: string[] = process.argv.slice(NODE_SCRIPT_ARGV_SKIP_COUNT)): void {
  const NODE_PACKAGE_VERSION = "${NODE_PACKAGE_VERSION}";
  const program = new Command();

  program
    .name("obsidian-dev-utils")
    .description("CLI to some obsidian-dev-utils commands")
    .version(NODE_PACKAGE_VERSION);

  program.command("build")
    .description("Build the plugin")
    .action(wrapCliTask(() => buildObsidianPlugin({ mode: BuildMode.Production })));

  program.command("dev")
    .description("Build the plugin in development mode")
    .action(wrapCliTask(() => buildObsidianPlugin({ mode: BuildMode.Development })));

  program.command("lint")
    .description("Lints the source code")
    .action(wrapCliTask(() => lint()));

  program.command("lint-fix")
    .description("Lints the source code and applies automatic fixes if possible")
    .action(wrapCliTask(() => lint(true)));

  program.command("spellcheck")
    .description("Spellcheck the source code")
    .action(wrapCliTask(() => spellcheck()));

  program.command("version")
    .description("Release new version")
    .argument("<versionUpdateType>", "Version update type: major, minor, patch, beta, or x.y.z[-suffix]")
    .action(wrapCliTask(async (version: string) => updateVersion(version)));

  program.parse(argv, { from: "user" });
}

export function wrapCliTask<TaskArgs extends unknown[]>(taskFn: (...taskArgs: TaskArgs) => MaybePromise<TaskResult | void>): (...taskArgs: TaskArgs) => Promise<void> {
  return async (...taskArgs: TaskArgs) => {
    const result = await getTaskResult(taskFn, taskArgs);
    result.exit();
  };
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
