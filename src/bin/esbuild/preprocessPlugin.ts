import type { Plugin } from "esbuild";
import { readFile } from "node:fs/promises";

export function preprocessPlugin(): Plugin {
  return {
    name: "preprocess",
    setup(build): void {
      build.onLoad({ filter: /\.(js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, "utf-8");

        const importMetaUrlReplacementStr = "import_meta_url";
        // HACK: We cannot use "import(dot)meta(dot)url" string in this file, because we don't want this file to be transformed when the same replacement applied to it.
        const importMetaUrlOriginalStr = importMetaUrlReplacementStr.replaceAll("_", ".");
        if (contents.includes(importMetaUrlOriginalStr)) {
          contents = `const ${importMetaUrlReplacementStr} = require("node:url").pathToFileURL(__filename);\n` + contents.replaceAll(importMetaUrlOriginalStr, importMetaUrlReplacementStr);
        }
        // HACK: The ${""} part is used to ensure Obsidian loads the plugin properly otherwise it stops loading it after the first line of the sourceMappingURL comment.
        contents = contents.replace(/\`\r?\n\/\/# sourceMappingURL/g, "`\n//#${\"\"} sourceMappingURL");

        if (/\bprocess\./.test(contents)) {
          contents = `globalThis.process ??= {
  platform: "mobile",
  cwd: () => "/",
  env: {}
};
` + contents;
        }

        return {
          contents,
          loader: "ts"
        };
      });
    },
  };
}
