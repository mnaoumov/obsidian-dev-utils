import type { Plugin } from "esbuild";
import {
  readFile,
  writeFile
} from "node:fs/promises";
import { toPosixPath } from "../Path.ts";

type SourceMap = {
  sources: string[];
};

export default function fixSourceMapsPlugin(isProductionBuild: boolean, distPath: string, pluginName: string): Plugin {
  return {
    name: "fix-source-maps",
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild) {
          return;
        }

        const content = await readFile(distPath, "utf8");
        const newContent = content.replaceAll(/\n\/\/# sourceMappingURL=data:application\/json;base64,(.+)/g, (_: string, sourceMapBase64: string): string => {
          return `\n//# sourceMappingURL=data:application/json;base64,${fixSourceMap(sourceMapBase64, pluginName)}`;
        });

        if (content !== newContent) {
          await writeFile(distPath, newContent);
        }
      });
    }
  };
}

function fixSourceMap(sourceMapBase64: string, pluginName: string): string {
  const sourceMapJson = Buffer.from(sourceMapBase64, "base64").toString("utf8");
  const sourceMap = JSON.parse(sourceMapJson) as SourceMap;
  sourceMap.sources = sourceMap.sources.map(path => convertPathToObsidianUrl(path, pluginName));
  return Buffer.from(JSON.stringify(sourceMap)).toString("base64");
}

function convertPathToObsidianUrl(path: string, pluginName: string): string {
  const convertedPath = toPosixPath(path).replace(/^(\.\.\/)+/, "");
  return `app://obsidian.md/plugin:${pluginName}/${convertedPath}`;
}
