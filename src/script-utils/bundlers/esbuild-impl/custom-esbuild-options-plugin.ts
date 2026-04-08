/**
 * @file
 *
 * This module defines an esbuild plugin that allows for custom esbuild options to be used during the build process.
 */

/* v8 ignore start -- esbuild plugin that applies custom build options; requires a live esbuild context. */

import type {
  BuildOptions,
  Plugin
} from 'esbuild';

/**
 * A plugin that allows for custom esbuild options to be used during the build process.
 *
 * @param customizeEsbuildOptions - A function that customizes the esbuild options.
 * @returns A plugin that allows for custom esbuild options to be used during the build process.
 */
export function customEsbuildOptionsPlugin(customizeEsbuildOptions?: (options: BuildOptions) => void): Plugin {
  return {
    name: 'custom-esbuild-options',
    setup(build): void {
      customizeEsbuildOptions?.(build.initialOptions);
    }
  };
}

/* v8 ignore stop */
