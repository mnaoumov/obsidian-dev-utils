import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/CodeGenerator.ts";
import { wrapCliTask } from "../src/bin/cli.ts";
import { getDependenciesToBundle } from "../src/bin/esbuild/Dependency.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  const dependenciesToBundle = await getDependenciesToBundle();
  await generate(ObsidianDevUtilsRepoPaths.SrcDependenciesTs, dependenciesToBundle.map(makeExport));
});

function makeExport(dependency: string): string {
  return `export * as ${makeValidVariableName(dependency)} from "${dependency}";`;
}
