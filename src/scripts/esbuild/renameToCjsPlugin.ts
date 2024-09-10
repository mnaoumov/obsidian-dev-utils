/**
 * @packageDocumentation renameToCjsPlugin
 * This module defines an esbuild plugin that renames JavaScript files to CommonJS (`.cjs`) files after the build process.
 * It also adjusts the `require` statements to ensure compatibility with the CommonJS format, particularly when dealing
 * with dependencies that are not to be skipped.
 */

import type { Plugin } from 'esbuild';

import { writeFile } from '../NodeModules.ts';

interface EsmModule {
  __esModule: boolean;
  default: unknown;
}

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
      build.initialOptions.banner ??= {};
      build.initialOptions.banner['js'] ??= '';
      build.initialOptions.banner['js'] += '\n' + `(${patchRequireEsmDefault.toString()})()\n`;

      build.onEnd(async (result) => {
        for (const file of result.outputFiles ?? []) {
          if (!file.path.endsWith('.js') || file.path.endsWith('.d.js')) {
            continue;
          }

          const newPath = file.path.replaceAll(/\.js$/g, '.cjs');

          const newText = file.text.replaceAll(/require\(["'](.+?)["']\)/g, (_, importPath: string) => {
            if (importPath.endsWith('.d.ts')) {
              return 'undefined';
            }

            const cjsImportPath = importPath.replaceAll(/\.ts$/g, '.cjs');
            return `require('${cjsImportPath}')`;
          });

          await writeFile(newPath, newText);
        }
      });
    }
  };
}

function patchRequireEsmDefault(): void {
  const __require = require;
  require = Object.assign((id: string): unknown => {
    const module = __require(id) as Partial<EsmModule>;
    return module.__esModule && module.default ? module.default : module;
  }, __require);
}
