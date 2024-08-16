import esbuild, { type BuildOptions } from "esbuild";
import {
  banner,
  invoke
} from "../src/bin/esbuild/PluginBuilder.ts";
import preprocessPlugin from "../src/bin/esbuild/preprocessPlugin.ts";
import { wrapTask } from "../src/bin/cli.ts";
import renameToCjsPlugin from "../src/bin/esbuild/renameToCjsPlugin.ts";
import { rm } from "node:fs/promises";

await (wrapTask(async () => {
  await rm("src/_bundle.ts", { force: true });

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
      renameToCjsPlugin()
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true,
    write: false
  };

  const context = await esbuild.context(buildOptions);
  await invoke(context, true);
}))();
