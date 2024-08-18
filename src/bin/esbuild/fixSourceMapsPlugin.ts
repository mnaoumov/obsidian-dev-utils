/**
 * @fileoverview
 * This module defines an esbuild plugin that fixes source maps generated during development.
 * It adjusts the paths in the source maps to be compatible with Obsidian's internal URL scheme.
 * The plugin is only active during development builds.
 */

import type { Plugin } from "esbuild";
import {
  readFile,
  writeFile
} from "node:fs/promises";
import { toPosixPath } from "../../Path.ts";

type SourceMap = {
  sources: string[];
};

/**
 * Creates an esbuild plugin that fixes source maps by adjusting the paths to be compatible
 * with Obsidian's internal URL scheme.
 *
 * @param isProductionBuild - A boolean indicating whether the build is a production build. The plugin only runs in non-production builds.
 * @param distPath - The path to the output file containing the source map.
 * @param pluginName - The name of the Obsidian plugin, used to construct the Obsidian-specific URLs.
 * @returns An esbuild `Plugin` object that fixes source maps.
 */
export function fixSourceMapsPlugin(isProductionBuild: boolean, distPath: string, pluginName: string): Plugin {
  return {
    name: "fix-source-maps",
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild) {
          return;
        }

        const content = await readFile(distPath, "utf-8");
        const newContent = content.replaceAll(
          /\n\/\/# sourceMappingURL=data:application\/json;base64,(.+)/g,
          (_: string, sourceMapBase64: string): string => {
            return `\n//# sourceMappingURL=data:application/json;base64,${fixSourceMap(sourceMapBase64, pluginName)}`;
          }
        );

        if (content !== newContent) {
          await writeFile(distPath, newContent);
        }
      });
    }
  };
}

/**
 * Adjusts the paths in the base64-encoded source map to be compatible with Obsidian's URL scheme.
 *
 * @param sourceMapBase64 - The base64-encoded source map content.
 * @param pluginName - The name of the Obsidian plugin, used to construct the Obsidian-specific URLs.
 * @returns A base64-encoded string with the adjusted source map.
 */
function fixSourceMap(sourceMapBase64: string, pluginName: string): string {
  const sourceMapJson = Buffer.from(sourceMapBase64, "base64").toString("utf-8");
  const sourceMap = JSON.parse(sourceMapJson) as SourceMap;
  sourceMap.sources = sourceMap.sources.map(path => convertPathToObsidianUrl(path, pluginName));
  return Buffer.from(JSON.stringify(sourceMap)).toString("base64");
}

/**
 * Converts a given file path to an Obsidian-specific URL.
 *
 * @param path - The original file path.
 * @param pluginName - The name of the Obsidian plugin.
 * @returns The converted path as an Obsidian-specific URL.
 */
function convertPathToObsidianUrl(path: string, pluginName: string): string {
  const convertedPath = toPosixPath(path).replace(/^(\.\.\/)+/, "");
  return `app://obsidian.md/plugin:${pluginName}/${convertedPath}`;
}
