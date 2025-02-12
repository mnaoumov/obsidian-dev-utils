/**
 * @packageDocumentation copyToObsidianPluginsFolderPlugin
 * This module defines an esbuild plugin that automatically copies the build output
 * to the Obsidian plugins folder during development. This plugin helps streamline
 * the development workflow by ensuring that the latest build is always available
 * in the correct Obsidian directory for testing and use.
 */

import type { Plugin } from 'esbuild';

import {
  join,
  toPosixPath
} from '../../Path.ts';
import {
  cp,
  existsSync,
  mkdir,
  writeFile
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
  obsidianConfigDir: string,
  pluginName: string
): Plugin {
  return {
    name: 'copy-to-obsidian-plugins-folder',
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild || !obsidianConfigDir) {
          return;
        }

        obsidianConfigDir = toPosixPath(obsidianConfigDir);

        const pluginDir = join(obsidianConfigDir, 'plugins', pluginName);

        if (!existsSync(pluginDir)) {
          await mkdir(pluginDir, { recursive: true });
        }

        await cp(distDir, pluginDir, { recursive: true });

        const hotReloadDir = join(obsidianConfigDir, 'plugins/hot-reload');
        if (!existsSync(hotReloadDir)) {
          await mkdir(hotReloadDir, { recursive: true });
          const hotReloadRepoUrl = 'https://raw.githubusercontent.com/pjeby/hot-reload/master/';
          for (const fileName of ['main.js', 'manifest.json']) {
            const fileUrl = hotReloadRepoUrl + fileName;
            const response = await fetch(fileUrl);
            const text = await response.text();
            await writeFile(join(hotReloadDir, fileName), text);
          }
        }
      });
    }
  };
}
