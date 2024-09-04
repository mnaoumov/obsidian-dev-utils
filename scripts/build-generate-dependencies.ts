import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/scripts/CodeGenerator.ts";
import { wrapCliTask } from "../src/scripts/CliUtils.ts";
import { getDependenciesToBundle } from "../src/scripts/esbuild/Dependency.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/scripts/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  const dependenciesToBundle = await getDependenciesToBundle();
  await generate(ObsidianDevUtilsRepoPaths.SrcDependenciesTs, dependenciesToBundle.map(makeExport));
});

function makeExport(dependency: string): string {
  return `export * as ${makeValidVariableName(dependency)} from "${dependency}";`;
}
