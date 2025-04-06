/**
 * @packageDocumentation
 *
 * Svelte wrapper esbuild plugin.
 */

import type { Plugin } from 'esbuild';

import esbuildSvelte_ from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';

import { readPackageJson } from '../Npm.ts';

const esbuildSvelte = esbuildSvelte_ as unknown as typeof esbuildSvelte_.default;

/**
 * Wraps the esbuild-svelte plugin to ensure that the correct format is used.
 *
 * @param isProductionBuild - Whether the build is a production build.
 * @returns The esbuild plugin.
 */
export function svelteWrapperPlugin(isProductionBuild: boolean): Plugin {
  const esbuildSveltePlugin = esbuildSvelte({
    compilerOptions: {
      css: 'injected',
      dev: !isProductionBuild
    },
    moduleCompilerOptions: {
      dev: !isProductionBuild
    },
    preprocess: sveltePreprocess()
  });

  return {
    name: 'svelte-wrapper',
    async setup(build): Promise<void> {
      const packageJson = await readPackageJson();
      const format = packageJson.type === 'module' ? 'esm' : 'cjs';
      await esbuildSveltePlugin.setup({
        ...build,
        initialOptions: {
          ...build.initialOptions,
          format
        }
      });
    }
  };
}
