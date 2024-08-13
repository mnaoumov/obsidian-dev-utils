import { Command } from "commander";
import {
  BuildMode,
  buildPlugin
} from "../PluginBuilder.ts";

const NODE_PACKAGE_VERSION = "${NODE_PACKAGE_VERSION}";
const program = new Command();

program
  .name("obsidian-dev-utils")
  .description('CLI to some obsidian-dev-utils commands')
  .version(NODE_PACKAGE_VERSION);

program.command("build")
  .description("Build the plugin")
  .action(() => {
    buildPlugin({ mode: BuildMode.Production });
  });

program.command("dev")
  .description("Build the plugin in development mode")
  .action(() => {
    buildPlugin({ mode: BuildMode.Development });
  });

program.command("lint")
  .description("Lints the source code")
  .action(() => {
    console.log("build");
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
    console.log
  });

program.parse();
