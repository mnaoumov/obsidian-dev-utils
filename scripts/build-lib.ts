import {
  type BuildOptions,
  context
} from "esbuild";
import {
  banner,
  invoke
} from "../src/bin/esbuild/PluginBuilder.ts";
import { preprocessPlugin } from "../src/bin/esbuild/preprocessPlugin.ts";
import { wrapTask } from "../src/bin/cli.ts";
import { renameToCjsPlugin } from "../src/bin/esbuild/renameToCjsPlugin.ts";
import { getDependenciesToSkip } from "../src/bin/esbuild/Dependency.ts";

await (wrapTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: ["src/**/*.ts"],
    format: "cjs",
    logLevel: "info",
    outdir: "dist/lib",
    platform: "node",
    plugins: [
      preprocessPlugin(),
      renameToCjsPlugin(dependenciesToSkip)
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invoke(buildContext, true);
}))();
