import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/CodeGenerator.ts";
import { wrapTask } from "../src/bin/cli.ts";
import { getDependenciesToBundle } from "../src/bin/esbuild/Dependency.ts";

async function main(): Promise<void> {
  await wrapTask(async () => {
    const dependenciesToBundle = await getDependenciesToBundle();
    await generate("src/_bundle.ts", dependenciesToBundle.map(makeExport));
  })();
}

function makeExport(dependency: string): string {
  return `export * as ${makeValidVariableName(dependency)} from "${dependency}";`;
}

await main();
