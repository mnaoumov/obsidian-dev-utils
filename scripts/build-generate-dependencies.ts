import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/CodeGenerator.ts";
import { wrapCliTask } from "../src/bin/cli.ts";
import { getDependenciesToBundle } from "../src/bin/esbuild/Dependency.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  const dependenciesToBundle = await getDependenciesToBundle();
  const code = `import { getModule } from "./Module.ts";
import { invokeAsyncSafely } from "./Async.ts";

const dependencies: Record<string, unknown> = {};

async function initDependencies(): Promise<void> {
${dependenciesToBundle.map(initDependency).join("\n")}
}

invokeAsyncSafely(initDependencies());

module.exports = dependencies;
`;
  await generate(ObsidianDevUtilsRepoPaths.SrcDependenciesCts, [code]);
});

function initDependency(dependency: string): string {
  return `  dependencies["${makeValidVariableName(dependency)}"] = await getModule("${dependency}");`;
}
