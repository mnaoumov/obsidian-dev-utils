import esbuild, { type BuildOptions } from "esbuild";
import {
  banner,
  invoke
} from "../src/esbuild/PluginBuilder.ts";
import preprocessPlugin from "../src/esbuild/preprocessPlugin.ts";
import renameToCjsPlugin from "../src/esbuild/renameToCjsPlugin.ts";
import { wrapTask } from "../src/cli.ts";

await (wrapTask(async () => {
  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: ["src/**/*.ts"],
    external: [
      "@typescript-eslint/parser",
      "esbuild",
      "eslint",
      "obsidian"
    ],
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
