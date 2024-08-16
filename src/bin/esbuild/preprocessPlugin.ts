import type { Plugin } from "esbuild";
import { readFile } from "node:fs/promises";

export function preprocessPlugin(): Plugin {
  return {
    name: "preprocess",
    setup(build): void {
      build.onLoad({ filter: /\.(js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, "utf8");
        if (contents.match(/import\.meta\.url/)) {
          contents = "const import_meta_url = require(\"node:url\").pathToFileURL(__filename);\n" + contents.replaceAll(/import\.meta\.url/g, "import_meta_url");
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
