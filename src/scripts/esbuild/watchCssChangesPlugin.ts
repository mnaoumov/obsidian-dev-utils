import type {
  OnLoadResult,
  Plugin
} from 'esbuild';

import { ObsidianPluginRepoPaths } from '../../obsidian/Plugin/ObsidianPluginRepoPaths.ts';
import { existsSync } from '../NodeModules.ts';
import { resolvePathFromRootSafe } from '../Root.ts';

/**
 * @returns A plugin that watches for changes to CSS files and rebuilds the plugin when they change.
 */
export function watchCssChangesPlugin(): Plugin {
  let isInitialized = false;

  return {
    name: 'watch-css-changes',
    setup(build): void {
      build.onLoad({ filter: /\.*/ }, (): null | OnLoadResult => {
        if (isInitialized) {
          return null;
        }

        isInitialized = true;

        const stylesCssPath = resolvePathFromRootSafe(ObsidianPluginRepoPaths.StylesCss);
        if (!existsSync(stylesCssPath)) {
          return null;
        }

        return {
          watchFiles: [stylesCssPath]
        };
      });
    }
  };
}
