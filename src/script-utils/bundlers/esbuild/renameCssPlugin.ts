/**
 * @packageDocumentation
 *
 * Rename CSS esbuild plugin.
 */

/* v8 ignore start -- esbuild plugin that renames CSS output files; requires a live esbuild context. */

import type { Plugin } from 'esbuild';

import { ObsidianPluginRepoPaths } from '../../../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import { join } from '../../../path.ts';
import {
  existsSync,
  rename
} from '../../node-modules.ts';

/**
 * Plugin that renames the CSS file to the correct name.
 *
 * @param distFolder - The folder to rename the CSS file in.
 * @returns The plugin.
 */
export function renameCssPlugin(distFolder: string): Plugin {
  return {
    name: 'rename-css',
    setup(build): void {
      build.onEnd(async () => {
        const mainCssPath = join(distFolder, ObsidianPluginRepoPaths.MainCss);
        const stylesCssPath = join(distFolder, ObsidianPluginRepoPaths.StylesCss);
        if (existsSync(mainCssPath)) {
          await rename(mainCssPath, stylesCssPath);
        }
      });
    }
  };
}

/* v8 ignore stop */
