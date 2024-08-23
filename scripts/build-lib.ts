import {
  type BuildOptions,
  context
} from "esbuild";
import {
  banner,
  invokeEsbuild
} from "../src/bin/esbuild/ObsidianPluginBuilder.ts";
import { preprocessPlugin } from "../src/bin/esbuild/preprocessPlugin.ts";
import { wrapCliTask } from "../src/cli.ts";
import { renameToCjsPlugin } from "../src/bin/esbuild/renameToCjsPlugin.ts";
import { getDependenciesToSkip } from "../src/bin/esbuild/Dependency.ts";
import { readdirPosix } from "../src/Fs.ts";
import {
  join,
  normalizeIfRelative
} from "../src/Path.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: false,
    entryPoints: await getLibFiles(),
    format: "cjs",
    logLevel: "info",
    outdir: ObsidianDevUtilsRepoPaths.DistLib,
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
  await invokeEsbuild(buildContext, true);
});

async function getLibFiles(): Promise<string[]> {
  let files = await readdirPosix(ObsidianDevUtilsRepoPaths.Src, { recursive: true });
  files = files.map((file) => normalizeIfRelative(join(ObsidianDevUtilsRepoPaths.Src, file)));
  files = files.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));
  files = files.filter((file) => file !== ObsidianDevUtilsRepoPaths.SrcDependenciesTs as string);
  return files;
}
