import { context, type BuildOptions } from "esbuild";
import { wrapTask } from "../src/bin/cli.ts";
import { getDependenciesToSkip } from "../src/bin/esbuild/Dependency.ts";
import { banner, invoke } from "../src/bin/esbuild/PluginBuilder.ts";
import { preprocessPlugin } from "../src/bin/esbuild/preprocessPlugin.ts";

await(wrapTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: ["src/_dependencies.ts"],
    external: Array.from(dependenciesToSkip),
    format: "cjs",
    logLevel: "info",
    outfile: "dist/lib/_dependencies.cjs",
    platform: "node",
    plugins: [
      preprocessPlugin()
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true
  };

  const buildContext = await context(buildOptions);
  await invoke(buildContext, true);
}))();
