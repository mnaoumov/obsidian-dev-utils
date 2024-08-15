import { Command } from "commander";
import {
  BuildMode,
  buildPlugin
} from "./PluginBuilder.ts";
import process from "node:process";
import { lintAndFix } from "./ESLint/ESLint.ts";

export function cli(argv: string[] = process.argv.slice(2)): void {
  const NODE_PACKAGE_VERSION = "${NODE_PACKAGE_VERSION}";
  const program = new Command();

  program
    .name("obsidian-dev-utils")
    .description("CLI to some obsidian-dev-utils commands")
    .version(NODE_PACKAGE_VERSION);

  program.command("build")
    .description("Build the plugin")
    .action(async () => {
      await buildPlugin({ mode: BuildMode.Production });
    });

  program.command("dev")
    .description("Build the plugin in development mode")
    .action(async () => {
      await buildPlugin({ mode: BuildMode.Development });
    });

  program.command("lint")
    .description("Lints the source code")
    .action(async () => {
      await lintAndFix();
    });

  program.command("version")
    .description("Release new version")
    .argument("<major|minor|patch>", "Version to release")
    .action((version) => {
      console.log(`version ${version}`);
    });

  program.command("spellcheck")
    .description("Spellcheck the source code")
    .action(() => {
      console.log;
    });

  program.parse(argv, { from: "user" });
}
