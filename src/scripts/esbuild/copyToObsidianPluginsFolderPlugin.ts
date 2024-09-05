/**
 * @packageDocumentation copyToObsidianPluginsFolderPlugin
 * This module defines an esbuild plugin that automatically copies the build output
 * to the Obsidian plugins folder during development. This plugin helps streamline
 * the development workflow by ensuring that the latest build is always available
 * in the correct Obsidian directory for testing and use.
 */

import type { Plugin } from 'esbuild';

import { join } from '../../Path.ts';
import { cp,
  existsSync,
  mkdir
} from '../NodeModules.ts';

/**
 * Creates an esbuild plugin that copies the build output to the Obsidian plugins folder.
 *
 * @param isProductionBuild - A boolean indicating whether the build is a production build.
 * @param distDir - The directory where the built files are located.
 * @param obsidianConfigDir - The directory of the Obsidian configuration. If not provided, the plugin will not copy files.
 * @param pluginName - The name of the Obsidian plugin.
 * @returns An esbuild `Plugin` object.
 */
export function copyToObsidianPluginsFolderPlugin(
  isProductionBuild: boolean,
  distDir: string,
  obsidianConfigDir: string | undefined,
  pluginName: string
): Plugin {
  return {
    name: 'copy-to-obsidian-plugins-folder',
    setup(build): void {
      build.onEnd(async () => {
        // Skip copying during production build or if the Obsidian config directory is not provided
        if (isProductionBuild || !obsidianConfigDir) {
          return;
        }

        const pluginDir = join(obsidianConfigDir, 'plugins', pluginName);

        // Create the plugin directory if it doesn't exist
        if (!existsSync(pluginDir)) {
          await mkdir(pluginDir);
        }

        // Copy the built files to the plugin directory
        await cp(distDir, pluginDir, { recursive: true });
      });
    }
  };
}
