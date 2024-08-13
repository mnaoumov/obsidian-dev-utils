import { Command } from "commander";

const VERSION = "TODO";
const program = new Command();

program
  .name("obsidian-dev-utils")
  .description('CLI to some obsidian-dev-utils commands')
  .version(VERSION);

program.command("build")
  .description("Build the plugin")
  .action(() => {
    console.log("build");
  });

program.command("dev")
  .description("Build the plugin in development mode")
  .action(() => {
    console.log("dev");
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
