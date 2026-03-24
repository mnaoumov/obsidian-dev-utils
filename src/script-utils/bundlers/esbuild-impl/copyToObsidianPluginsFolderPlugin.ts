/**
 * @packageDocumentation
 *
 * This module defines an esbuild plugin that automatically copies the build output
 * to the Obsidian plugins folder during development. This plugin helps streamline
 * the development workflow by ensuring that the latest build is always available
 * in the correct Obsidian folder for testing and use.
 */

/* v8 ignore start -- esbuild plugin that copies build output to Obsidian plugins folder; requires a live esbuild context. */

import type { Plugin } from 'esbuild';

import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import { evalInObsidian } from 'obsidian-integration-testing';

import { getLibDebugger } from '../../../debug.ts';
import {
  join,
  toPosixPath
} from '../../../path.ts';

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

        await enableCommunityPlugin(obsidianConfigFolder, 'hot-reload');
        await enableCommunityPlugin(obsidianConfigFolder, pluginName);
      });
    }
  };
}

async function enableCommunityPlugin(obsidianConfigFolder: string, pluginId: string): Promise<void> {
  const communityPluginsPath = join(obsidianConfigFolder, 'community-plugins.json');
  let plugins: string[] = [];
  if (existsSync(communityPluginsPath)) {
    const content = await readFile(communityPluginsPath, 'utf-8');
    plugins = JSON.parse(content) as string[];
  }

  if (!plugins.includes(pluginId)) {
    plugins.push(pluginId);
    const JSON_INDENT = 2;
    await writeFile(communityPluginsPath, JSON.stringify(plugins, null, JSON_INDENT), 'utf-8');
  }

  try {
    await evalInObsidian({
      args: { pluginId },
      // eslint-disable-next-line no-shadow -- No actual shadowing as the function is executed externally.
      async fn({ app, pluginId }) {
        await app.plugins.enablePluginAndSave(pluginId);
      },
      vaultPath: obsidianConfigFolder
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const isNotFound = errorMessage.includes('ENOENT') || errorMessage.includes('not found') || errorMessage.includes('not recognized');
    if (isNotFound) {
      console.error(`Obsidian CLI is not installed. Plugin '${pluginId}' will be enabled on next vault open. See https://help.obsidian.md/cli`);
    } else {
      console.error(`Failed to enable plugin '${pluginId}' via Obsidian CLI.`, e);
    }
  }
}

/* v8 ignore stop */
