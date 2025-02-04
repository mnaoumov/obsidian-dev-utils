/**
 * @packageDocumentation renameToCjsPlugin
 * This module defines an esbuild plugin that renames JavaScript files to CommonJS (`.cjs`) files after the build process.
 * It also adjusts the `require` statements to ensure compatibility with the CommonJS format, particularly when dealing
 * with dependencies that are not to be skipped.
 */

import type { Plugin } from 'esbuild';

import { replaceAll } from '../../String.ts';
import { writeFile } from '../NodeModules.ts';

/**
 * Creates an esbuild plugin that renames JavaScript files to CommonJS (`.cjs`) files
 * and modifies `require` statements to ensure proper module resolution.
 *
 * @returns An esbuild `Plugin` object that handles the renaming and modification of output files.
 */
export function renameToCjsPlugin(): Plugin {
  return {
    name: 'rename-to-cjs',
    setup(build): void {
      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith('.js') || file.path.endsWith('.d.js')) {
            continue;
          }

          const newPath = replaceAll(file.path, /\.js$/g, '.cjs');

          const newText = replaceAll(file.text, /require\(["'](?<ImportPath>.+?)["']\)/g, (_, importPath) => {
            if (importPath.endsWith('.d.ts')) {
              return 'undefined';
            }

            const cjsImportPath = replaceAll(importPath, /\.ts$/g, '.cjs');
            return `require('${cjsImportPath}')`;
          });

          await writeFile(newPath, newText);
        }
      });
    }
  };
}
