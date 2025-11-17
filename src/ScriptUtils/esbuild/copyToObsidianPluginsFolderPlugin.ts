/**
 * @packageDocumentation
 *
 * This module defines an esbuild plugin that automatically copies the build output
 * to the Obsidian plugins folder during development. This plugin helps streamline
 * the development workflow by ensuring that the latest build is always available
 * in the correct Obsidian folder for testing and use.
 */

import type { Plugin } from 'esbuild';

import { getLibDebugger } from '../../Debug.ts';
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
 * @param distFolder - The folder where the built files are located.
 * @param obsidianConfigFolder - The folder of the Obsidian configuration. If not provided, the plugin will not copy files.
 * @param pluginName - The name of the Obsidian plugin.
 * @returns An esbuild `Plugin` object.
 */
export function copyToObsidianPluginsFolderPlugin(
  isProductionBuild: boolean,
  distFolder: string,
  obsidianConfigFolder: string,
  pluginName: string
): Plugin {
  return {
    name: 'copy-to-obsidian-plugins-folder',
    setup(build): void {
      build.onEnd(async () => {
        if (isProductionBuild) {
          return;
        }

        if (!obsidianConfigFolder) {
          getLibDebugger('copyToObsidianPluginsFolderPlugin')(
            'No Obsidian config folder configured. `OBSIDIAN_CONFIG_FOLDER` environment variable is not set in system or in `.env` file. The compiled plugin will not be copied into Obsidian plugins folder.'
          );
          return;
        }

        obsidianConfigFolder = toPosixPath(obsidianConfigFolder);

        const pluginFolder = join(obsidianConfigFolder, 'plugins', pluginName);

        if (!existsSync(pluginFolder)) {
          await mkdir(pluginFolder, { recursive: true });
        }

        await cp(distFolder, pluginFolder, { recursive: true });

        const hotReloadFolder = join(obsidianConfigFolder, 'plugins/hot-reload');
        if (!existsSync(hotReloadFolder)) {
          await mkdir(hotReloadFolder, { recursive: true });
          const hotReloadRepoUrl = 'https://raw.githubusercontent.com/pjeby/hot-reload/master/';
          for (const fileName of ['main.js', 'manifest.json']) {
            const fileUrl = hotReloadRepoUrl + fileName;
            // eslint-disable-next-line no-restricted-globals -- We run this outside of Obsidian, so we don't have `requestUrl()`.
            const response = await fetch(fileUrl);
            const text = await response.text();
            await writeFile(join(hotReloadFolder, fileName), text);
          }
        }
      });
    }
  };
}
