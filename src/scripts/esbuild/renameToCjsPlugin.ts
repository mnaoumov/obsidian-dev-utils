/**
 * @packageDocumentation renameToCjsPlugin
 * This module defines an esbuild plugin that renames JavaScript files to CommonJS (`.cjs`) files after the build process.
 * It also adjusts the `require` statements to ensure compatibility with the CommonJS format, particularly when dealing
 * with dependencies that are not to be skipped.
 */

import type { Plugin } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import {
  makeValidVariableName,
  trimStart
} from '../../String.ts';
import {
  dirname,
  normalizeIfRelative,
  relative,
  toPosixPath
} from '../../Path.ts';
import { resolvePathFromRoot } from '../Root.ts';
import { ObsidianDevUtilsRepoPaths } from '../ObsidianDevUtilsRepoPaths.ts';

/**
 * Creates an esbuild plugin that renames JavaScript files to CommonJS (`.cjs`) files
 * and modifies `require` statements to ensure proper module resolution.
 *
 * @param dependenciesToSkip - A set of dependencies that should not be bundled.
 * @returns An esbuild `Plugin` object that handles the renaming and modification of output files.
 */
export function renameToCjsPlugin(dependenciesToSkip: Set<string>): Plugin {
  const dependenciesPath = resolvePathFromRoot(ObsidianDevUtilsRepoPaths.DistLibDependenciesCjs);
  return {
    name: 'rename-to-cjs',
    setup(build): void {
      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith('.js') || file.path.endsWith('.d.js')) {
            continue;
          }

          const newPath = file.path.replaceAll(/\.js$/g, '.cjs');

          const newText = file.text.replaceAll(/require\("(.+?)"\)/g, (_, importPath: string) => {
            if (importPath.endsWith('.d.ts')) {
              return 'undefined';
            }

            const importPath1 = trimStart(importPath, 'node:');
            const importPath2 = importPath1.split('/')[0]!;

            if (importPath[0] !== '.' && !dependenciesToSkip.has(importPath1) && !dependenciesToSkip.has(importPath2)) {
              const relativeDependenciesPath = normalizeIfRelative(relative(dirname(toPosixPath(file.path)), dependenciesPath));
              const importPathVariable = makeValidVariableName(importPath);
              return `require("${relativeDependenciesPath}").${importPathVariable}.default ?? require("${relativeDependenciesPath}").${importPathVariable}`;
            }

            const cjsImportPath = importPath.replaceAll(/\.ts$/g, '.cjs');
            return `require("${cjsImportPath}")`;
          });

          await writeFile(newPath, newText);
        }
      });
    }
  };
}
