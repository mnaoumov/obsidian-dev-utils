import esbuild, {
  type BuildOptions,
  type Plugin
} from "esbuild";
import builtins from "builtin-modules";
import { banner, invoke } from "../src/bin/esbuild/PluginBuilder.ts";
import preprocessPlugin from "../src/bin/esbuild/preprocessPlugin.ts";
import { readNpmPackage } from "../src/Npm.ts";
import { makeValidVariableName } from "../src/String.ts";
import { generate } from "../src/CodeGenerator.ts";
import { wrapTask } from "../src/bin/cli.ts";

async function main(): Promise<void> {
  await wrapTask(async () => {
    const npmPackage = await readNpmPackage();
    const dependenciesToSkip = new Set<string>([...Object.keys(npmPackage.dependencies ?? {}), ...builtins]);
    const dependenciesToBundle = await getDependenciesToBundle(dependenciesToSkip);
    await generate("src/_bundle.ts", dependenciesToBundle.map(makeExport));

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

    const context = await esbuild.context(buildOptions);
    await invoke(context, true);
  })();
}

async function getDependenciesToBundle(dependenciesToSkip: Set<string>): Promise<string[]> {
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

  const context = await esbuild.context(buildOptions);
  await invoke(context, true);
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

function makeExport(dependency: string): string {
  return `export * as ${makeValidVariableName(dependency)} from "${dependency}";`
}

await main();
