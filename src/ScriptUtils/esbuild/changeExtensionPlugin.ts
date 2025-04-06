/**
 * @packageDocumentation
 *
 * This module defines an esbuild plugin that changes the extension of JavaScript files after the build process.
 */

import type { Plugin } from 'esbuild';

import { replaceAll } from '../../String.ts';
import { writeFile } from '../NodeModules.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';

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

          const newPath = replaceAll(file.path, /\.js$/g, extension);

          let newText = replaceAll(file.text, /require\(["'](?<ImportPath>.+?)["']\)/g, (_, importPath) => {
            if (importPath.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
              return 'undefined';
            }

            const fixedImportPath = replaceAll(importPath, /\.ts$/g, extension);
            return `require('${fixedImportPath}')`;
          });

          newText = replaceAll(newText, /from "(?<ImportPath>.+?)"/g, (_, importPath) => {
            if (importPath.endsWith(ObsidianDevUtilsRepoPaths.DtsExtension)) {
              return 'undefined';
            }

            const fixedImportPath = replaceAll(importPath, /\.ts$/g, extension);
            return `from "${fixedImportPath}"`;
          });

          await writeFile(newPath, newText);
        }
      });
    }
  };
}
