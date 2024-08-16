import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/CodeGenerator.ts";
import { wrapCliTask } from "../src/bin/cli.ts";
import {
  getDependenciesToBundle,
  SOURCE_DEPENDENCIES_PATH
} from "../src/bin/esbuild/Dependency.ts";

await wrapCliTask(async () => {
  const dependenciesToBundle = await getDependenciesToBundle();
  await generate(SOURCE_DEPENDENCIES_PATH, dependenciesToBundle.map(makeExport));
});

function makeExport(dependency: string): string {
  return `export * as ${makeValidVariableName(dependency)} from "${dependency}";`;
}
