import type { Plugin } from 'esbuild';

import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import { join } from '../../Path.ts';
import {
  existsSync,
  rename
} from '../NodeModules.ts';

/**
 * Plugin that renames the CSS file to the correct name.
 *
 * @param distDir - The directory to rename the CSS file in.
 * @returns The plugin.
 */
export function renameCssPlugin(distDir: string): Plugin {
  return {
    name: 'rename-css',
    setup(build): void {
      build.onEnd(async () => {
        const mainCssPath = join(distDir, ObsidianPluginRepoPaths.MainCss);
        const stylesCssPath = join(distDir, ObsidianPluginRepoPaths.StylesCss);
        if (existsSync(mainCssPath)) {
          await rename(mainCssPath, stylesCssPath);
        }
      });
    }
  };
}
