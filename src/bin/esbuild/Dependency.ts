import {
  type BuildOptions,
  context,
  type Plugin
} from "esbuild";
import { readNpmPackage } from "../../Npm.ts";
import builtins from "builtin-modules";
import { banner, invoke } from "./PluginBuilder.ts";
import preprocessPlugin from "./preprocessPlugin.ts";

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
    setup(build) {
      build.onResolve({ filter: /^[^\.\/]/ }, (args) => {
        if (!args.importer.endsWith(".d.ts")) {
          let moduleName = args.path.split("/")[0]!;
          if (moduleName.includes(":")) {
            moduleName = moduleName.split(":")[1]!;
          }
          if (!dependenciesToSkip.has(moduleName)) {
            dependenciesToBundle.add(args.path);
          }
        }
        return { path: args.path, external: true };
      });
    }
  }
}
