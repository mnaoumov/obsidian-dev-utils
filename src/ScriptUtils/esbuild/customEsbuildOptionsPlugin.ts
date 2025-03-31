/**
 * @packageDocumentation customEsbuildOptionsPlugin
 * This module defines an esbuild plugin that allows for custom esbuild options to be used during the build process.
 */

import type {
  BuildOptions,
  Plugin
} from 'esbuild';

/**
 * A plugin that allows for custom esbuild options to be used during the build process.
 *
 * @param customEsbuildOptions - The custom esbuild options to be used during the build process.
 * @returns A plugin that allows for custom esbuild options to be used during the build process.
 */
export function customEsbuildOptionsPlugin(customEsbuildOptions?: BuildOptions): Plugin {
  return {
    name: 'custom-esbuild-options',
    setup(build): void {
      Object.assign(build.initialOptions, customEsbuildOptions);
    }
  };
}
