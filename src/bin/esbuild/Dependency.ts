import {
  type BuildOptions,
  context,
  type Plugin
} from "esbuild";
import { readNpmPackage } from "../../Npm.ts";
import builtins from "builtin-modules";
import {
  banner,
  invoke
} from "./ObsidianPluginBuilder.ts";
import { preprocessPlugin } from "./preprocessPlugin.ts";
import { trimStart } from "../../String.ts";

export const SOURCE_DEPENDENCIES_PATH = "./src/_dependencies.ts";
export const COMPILED_DEPENDENCIES_PATH = "./dist/lib/_dependencies.cjs";

export async function getDependenciesToSkip(): Promise<Set<string>> {
  const npmPackage = await readNpmPackage();
  const dependenciesToSkip = new Set<string>([...Object.keys(npmPackage.dependencies ?? {}), ...builtins]);
  return dependenciesToSkip;
}

export async function getDependenciesToBundle(): Promise<string[]> {
  const dependenciesToSkip = await getDependenciesToSkip();
  const dependenciesToBundle = new Set<string>();

  const buildOptions: BuildOptions = {
    banner: {
      js: banner
    },
    bundle: true,
    entryPoints: ["src/**/*.ts"],
    format: "cjs",
    logLevel: "info",
    outdir: "dist/lib",
    platform: "node",
    plugins: [
      preprocessPlugin(),
      extractDependenciesToBundlePlugin(dependenciesToSkip, dependenciesToBundle)
    ],
    sourcemap: "inline",
    target: "ESNext",
    treeShaking: true,
    write: false
  };

  const buildContext = await context(buildOptions);
  await invoke(buildContext, true);
  return Array.from(dependenciesToBundle).sort();
}

function extractDependenciesToBundlePlugin(dependenciesToSkip: Set<string>, dependenciesToBundle: Set<string>): Plugin {
  return {
    name: "test",
    setup(build): void {
      build.onResolve({ filter: /^[^\.\/]/ }, (args) => {
        if (!args.importer.endsWith(".d.ts")) {
          const moduleName = trimStart(args.path.split("/")[0]!, "node:");
          if (!dependenciesToSkip.has(moduleName)) {
            dependenciesToBundle.add(args.path);
          }
        }
        return { path: args.path, external: true };
      });
    }
  };
}
