import type { Plugin } from "esbuild";
import { writeFile } from "node:fs/promises";
import {
  makeValidVariableName,
  trimStart
} from "../../String.ts";
import {
  dirname,
  normalizeIfRelative,
  relative,
  toPosixPath
} from "../../Path.ts";
import { resolvePathFromRoot } from "../../Root.ts";
import { COMPILED_DEPENDENCIES_PATH } from "./Dependency.ts";

export function renameToCjsPlugin(dependenciesToSkip: Set<string>): Plugin {
  const dependenciesPath = resolvePathFromRoot(COMPILED_DEPENDENCIES_PATH);
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
            const importPath1 = trimStart(importPath, "node:");
            const importPath2 = importPath1.split("/")[0]!;
            if (importPath[0] !== "." && !dependenciesToSkip.has(importPath1) && !dependenciesToSkip.has(importPath2)) {
              const relativeDependenciesPath = normalizeIfRelative(relative(dirname(toPosixPath(file.path)), dependenciesPath));
              const importPathVariable = makeValidVariableName(importPath);
              return `require("${relativeDependenciesPath}").${importPathVariable}.default ?? require("${relativeDependenciesPath}").${importPathVariable}`;
            }
            const cjsImportPath = importPath.replaceAll(/\.ts$/g, ".cjs");
            return `require("${cjsImportPath}")`;
          });
          await writeFile(newPath, newText);
        }
      });
    }
  };
}
