import type { Plugin } from "esbuild";
import { writeFile } from "node:fs/promises";
import {
  makeValidVariableName,
  trimStart
} from "../../String.ts";
import {
  dirname,
  relative,
  toPosixPath
} from "../../Path.ts";
import { resolvePathFromRoot } from "../../Root.ts";

export function renameToCjsPlugin(dependenciesToSkip: Set<string>): Plugin {
  const bundlePath = resolvePathFromRoot("dist/lib/_bundle.cjs");
  return {
    name: "rename-to-cjs",
    setup(build): void {
      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith(".js") || file.path.endsWith(".d.js")) {
            continue;
          }
          const newPath = file.path.replaceAll(/\.js$/g, ".cjs");
          const newText = file.text.replaceAll(/require\("(.+?)"\)/g, (_, importPath: string) => {
            let fixedImportPath = importPath;
            const importPath1 = trimStart(importPath, "node:");
            const importPath2 = importPath1.split("/")[0]!;
            if (importPath[0] !== "." && !dependenciesToSkip.has(importPath1) && !dependenciesToSkip.has(importPath2)) {
              let relativeBundlePath = relative(dirname(toPosixPath(file.path)), bundlePath);
              if (relativeBundlePath[0] !== ".") {
                relativeBundlePath = `./${relativeBundlePath}`;
              }
              return `require("${relativeBundlePath}").${makeValidVariableName(importPath)}.default ?? require("${relativeBundlePath}").${makeValidVariableName(importPath)}`;
            }
            if (importPath.endsWith(".ts")) {
              fixedImportPath = importPath.replaceAll(/\.ts$/g, ".cjs");
            }
            return `require("${fixedImportPath}")`;
          });
          await writeFile(newPath, newText);
        }
      });
    }
  };
}
