import { context, type BuildOptions } from "esbuild";
import { wrapTask } from "../src/bin/cli.ts";
import {
  COMPILED_DEPENDENCIES_PATH,
  getDependenciesToSkip,
  SOURCE_DEPENDENCIES_PATH
} from "../src/bin/esbuild/Dependency.ts";
import {
  banner,
  invoke
} from "../src/bin/esbuild/ObsidianPluginBuilder.ts";
import { preprocessPlugin } from "../src/bin/esbuild/preprocessPlugin.ts";

await (wrapTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: [SOURCE_DEPENDENCIES_PATH],
    external: Array.from(dependenciesToSkip),
    format: "cjs",
    logLevel: "info",
    outfile: COMPILED_DEPENDENCIES_PATH,
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
