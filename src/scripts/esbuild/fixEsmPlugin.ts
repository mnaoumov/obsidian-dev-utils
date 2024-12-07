/**
 * @packageDocumentation fixEsmPlugin
 * This module defines a custom esbuild plugin that fixes the `require` statement for ESM modules.
 */

import type { Plugin } from 'esbuild';

/**
 * Creates an esbuild plugin that fixes the `require` statement for ESM modules.
 *
 * @returns An esbuild `Plugin` object that fixes the `require` statement for ESM modules.
 */
export function fixEsmPlugin(): Plugin {
  return {
    name: 'fix-esm',
    setup(build): void {
      build.onEnd((result) => {
        for (const file of result.outputFiles ?? []) {
          const newText = file.text.replaceAll(/(__toESM\d*)\((.+), 1\);/g, '$1(__extractDefault($2), 1);');
          file.contents = new TextEncoder().encode(newText);
        }
      });
    }
  };
}
