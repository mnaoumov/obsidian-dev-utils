/**
 * @file
 *
 * This module defines an esbuild plugin that changes the extension of JavaScript files after the build process.
 */

/* v8 ignore start -- esbuild plugin that rewrites file extensions at build time; requires a live esbuild context. */

import type { Plugin } from 'esbuild';

import { writeFile } from 'node:fs/promises';

import { replaceAll } from '../../../string.ts';
import { ObsidianDevUtilsRepoPaths } from '../../obsidian-dev-utils-repo-paths.ts';

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

          let newText = replaceAll({
            replacer: ({ capturedGroupArgs: [importPath = ''] }) => {
              if (importPath.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
                return 'undefined';
              }

              const fixedImportPath = replaceAll({
                replacer: extension,
                searchValue: /\.ts$/g,
                str: importPath
              });
              return `require('${fixedImportPath}')`;
            },
            searchValue: /require\(["'](?<ImportPath>.+?)["']\)/g,
            str: file.text
          });

          newText = replaceAll({
            replacer: ({ capturedGroupArgs: [importPath = ''] }) => {
              if (importPath.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
                return 'undefined';
              }

              const fixedImportPath = replaceAll({
                replacer: extension,
                searchValue: /\.ts$/g,
                str: importPath
              });
              return `from "${fixedImportPath}"`;
            },
            searchValue: /from "(?<ImportPath>.+?)"/g,
            str: newText
          });

          await writeFile(newPath, newText);
        }
      });
    }
  };
}

/* v8 ignore stop */
