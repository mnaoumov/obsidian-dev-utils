import {
  context,
  type BuildOptions
} from "esbuild";
import { wrapCliTask } from "../src/bin/cli.ts";
import { getDependenciesToSkip } from "../src/bin/esbuild/Dependency.ts";
import {
  banner,
  invokeEsbuild
} from "../src/bin/esbuild/ObsidianPluginBuilder.ts";
import { preprocessPlugin } from "../src/bin/esbuild/preprocessPlugin.ts";
import { ObsidianDevUtilsRepoPaths } from "../src/bin/ObsidianDevUtilsRepoPaths.ts";

await wrapCliTask(async () => {
  const dependenciesToSkip = await getDependenciesToSkip();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: [ObsidianDevUtilsRepoPaths.SrcDependenciesTs],
    external: Array.from(dependenciesToSkip),
    format: "cjs",
    logLevel: "info",
    outfile: ObsidianDevUtilsRepoPaths.DistLibDependenciesCjs,
    platform: "node",
    plugins: [
      preprocessPlugin()
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true
  };

  const buildContext = await context(buildOptions);
  await invokeEsbuild(buildContext, true);
});
