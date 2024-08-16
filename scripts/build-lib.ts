import {
  type BuildOptions,
  context
} from "esbuild";
import {
  banner,
  invoke
} from "../src/bin/esbuild/PluginBuilder.ts";
import preprocessPlugin from "../src/bin/esbuild/preprocessPlugin.ts";
import { wrapTask } from "../src/bin/cli.ts";
import renameToCjsPlugin from "../src/bin/esbuild/renameToCjsPlugin.ts";
import { rm } from "node:fs/promises";
import { getDependenciesToSkip } from "../src/bin/esbuild/Dependency.ts";

await (wrapTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();
  await buildBundle(dependenciesToSkip);
  await buildLib(dependenciesToSkip);
}))();

async function buildBundle(dependenciesToSkip: Set<string>): Promise<void> {
  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: ["src/_bundle.ts"],
    external: Array.from(dependenciesToSkip),
    format: "cjs",
    logLevel: "info",
    outfile: "dist/lib/_bundle.cjs",
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
}

async function buildLib(dependenciesToSkip: Set<string>): Promise<void> {
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
      renameToCjsPlugin(dependenciesToSkip)
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invoke(buildContext, true);
}
