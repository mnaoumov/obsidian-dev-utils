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
  const stylesCssPath = resolvePathFromRootSafe(ObsidianPluginRepoPaths.StylesCss);
  const watchFiles: string[] = [];
  if (existsSync(stylesCssPath)) {
    watchFiles.push(ObsidianPluginRepoPaths.StylesCss);
  }

  return {
    name: 'watch-css-changes',
    setup(build): void {
      build.onLoad({ filter: /\.*/, namespace: 'watch-css-changes' }, (): OnLoadResult => {
        return {
          watchFiles
        };
      });
    }
  };
}
