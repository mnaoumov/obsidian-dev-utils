/**
 * @file
 *
 * This module defines an esbuild plugin that changes the extension of JavaScript files after the build process.
 */

import type { Plugin } from 'esbuild';

import { writeFile } from 'node:fs/promises';

import { replaceAll } from '../../../string.ts';
import { ObsidianDevUtilsRepoPaths } from '../../obsidian-dev-utils-repo-paths.ts';

/* v8 ignore start -- esbuild plugin that rewrites file extensions at build time; requires a live esbuild context. */

/**
 * Creates an esbuild plugin that changes the extension of JavaScript files after the build process.
 *
 * @param extension - The extension to change the files to.
 * @returns An esbuild `Plugin` object that handles the renaming and modification of output files.
 */
export function changeExtensionPlugin(extension: string): Plugin {
  return {
    name: 'change-extension',
    setup(build): void {
      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith(ObsidianDevUtilsRepoPaths.JsExtension) || file.path.endsWith(ObsidianDevUtilsRepoPaths.DjsExtension)) {
            continue;
          }

          const newPath = replaceAll({
            replacer: extension,
            searchValue: /\.js$/g,
            str: file.path
          });

          const newText = rewriteImportPathExtensions(file.text, extension);

          await writeFile(newPath, newText);
        }
      });
    }
  };
}

/* v8 ignore stop */

/**
 * Rewrites the extension of every import-like path in an emitted module's text from `.ts` to the target
 * output extension (`.mjs` / `.cjs`), so the multi-file `dist/lib` build references its real siblings.
 *
 * Covers `require('…')`, static `from "…"`, and dynamic `import("…")` occurrences.
 *
 * @param text - The emitted module text to rewrite.
 * @param extension - The output extension to rewrite `.ts` paths to (e.g. `.mjs` or `.cjs`).
 * @returns The rewritten module text.
 */
export function rewriteImportPathExtensions(text: string, extension: string): string {
  let newText = replaceAll({
    replacer: ({ capturedGroupArgs: [importPath = ''] }) => `require('${rewriteTsExtension(importPath, extension)}')`,
    searchValue: /require\(["'](?<ImportPath>.+?)["']\)/g,
    str: text
  });

  newText = replaceAll({
    replacer: ({ capturedGroupArgs: [importPath = ''] }) => `from "${rewriteTsExtension(importPath, extension)}"`,
    searchValue: /from "(?<ImportPath>.+?)"/g,
    str: newText
  });

  newText = replaceAll({
    replacer: ({ capturedGroupArgs: [importPath = ''] }) => `import("${rewriteTsExtension(importPath, extension)}")`,
    searchValue: /import\(["'](?<ImportPath>.+?)["']\)/g,
    str: newText
  });

  return newText;
}

/**
 * Rewrites a trailing `.ts` extension in a single import path to the target output extension.
 *
 * @param importPath - The captured import path.
 * @param extension - The output extension to rewrite a trailing `.ts` to.
 * @returns The rewritten path.
 */
function rewriteTsExtension(importPath: string, extension: string): string {
  return replaceAll({
    replacer: extension,
    searchValue: /\.ts$/g,
    str: importPath
  });
}
