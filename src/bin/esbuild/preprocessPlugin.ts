/**
 * @fileoverview
 * This module defines a custom esbuild plugin that preprocesses JavaScript and TypeScript files.
 * The preprocessing includes replacing `import(dot)meta(dot)url` with a Node.js-compatible alternative,
 * ensuring compatibility with Obsidian's plugin system, and adding a basic `process` object for environments
 * where `process` is not available (like mobile or web environments).
 *
 * @note
 * We cannot use `.` instead of `(dot)` in the above description because the file itself is preprocessed with the same rule.
 */

import type { Plugin } from "esbuild";
import { readFile } from "node:fs/promises";

/**
 * Creates an esbuild plugin that preprocesses JavaScript and TypeScript files.
 *
 * This plugin performs the following tasks:
 * - Replaces instances of `import.meta.url` with a Node.js-compatible `__filename` alternative.
 * - Modifies the `sourceMappingURL` comment to ensure compatibility with Obsidian's plugin system.
 * - Adds a basic `process` object to the global scope if `process` is referenced but not defined.
 *
 * @returns An esbuild `Plugin` object that handles the preprocessing.
 */
export function preprocessPlugin(): Plugin {
  return {
    name: "preprocess",
    setup(build): void {
      build.onLoad({ filter: /\.(js|ts|cjs|mjs|cts|mts)$/ }, async (args) => {
        let contents = await readFile(args.path, "utf-8");

        const importMetaUrlReplacementStr = "import_meta_url";
        // HACK: We cannot use "import.meta.url" string in this file directly,
        // because we don't want this file to be transformed when the same replacement is applied to it.
        const importMetaUrlOriginalStr = importMetaUrlReplacementStr.replaceAll("_", ".");
        if (contents.includes(importMetaUrlOriginalStr)) {
          contents = `const ${importMetaUrlReplacementStr} = require("node:url").pathToFileURL(__filename);\n`
            + contents.replaceAll(importMetaUrlOriginalStr, importMetaUrlReplacementStr);
        }

        // HACK: The ${""} part is used to ensure Obsidian loads the plugin properly,
        // otherwise, it stops loading after the first line of the sourceMappingURL comment.
        contents = contents.replace(/\`\r?\n\/\/# sourceMappingURL/g, "`\n//#${\"\"} sourceMappingURL");

        // Adds a basic `process` object if `process` is referenced but not defined in the global scope.
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
