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
import {
  getDependenciesToSkip,
  SOURCE_DEPENDENCIES_PATH
} from "../src/bin/esbuild/Dependency.ts";
import { readdirPosix } from "../src/Fs.ts";
import { join } from "../src/Path.ts";

await (wrapTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: await getLibFiles(),
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

async function getLibFiles(): Promise<string[]> {
  let files = await readdirPosix("src", { recursive: true });
  files = files.map((file) => join("./src", file));
  files = files.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));
  files = files.filter((file) => file !== SOURCE_DEPENDENCIES_PATH);
  return files;
}
