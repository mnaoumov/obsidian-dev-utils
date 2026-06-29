/**
 * @file
 *
 * This module defines an esbuild plugin that automatically copies the build output
 * to the Obsidian plugins folder during development. This plugin helps streamline
 * the development workflow by ensuring that the latest build is always available
 * in the correct Obsidian folder for testing and use.
 */

/* v8 ignore start -- esbuild plugin that copies build output to Obsidian plugins folder; requires a live esbuild context. */

import type { Plugin } from 'esbuild';
import type { ObsidianTransport } from 'obsidian-integration-testing';

import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import process from 'node:process';
import {
  createTransportFromOptions,
  evalInObsidian
} from 'obsidian-integration-testing';

import { getLibDebugger } from '../../../debug.ts';
import {
  dirname,
  join,
  toPosixPath
} from '../../../path.ts';

/**
 * Parameters for {@link copyToObsidianPluginsFolderPlugin}.
 */
export interface CopyToObsidianPluginsFolderPluginParams {
  /**
   * The folder where the built files are located.
   */
  readonly distFolder: string;

  /**
   * A boolean indicating whether the build is a production build.
   */
  readonly isProductionBuild: boolean;

  /**
   * The folder of the Obsidian configuration. If not provided, the plugin will not copy files.
   */
  readonly obsidianConfigFolder: string;

  /**
   * The name of the Obsidian plugin.
   */
  readonly pluginName: string;
}

/**
 * Parameters for {@link enableCommunityPlugin}.
 */
interface EnableCommunityPluginParams {
  /**
   * The folder of the Obsidian configuration.
   */
  readonly obsidianConfigFolder: string;

  /**
   * The ID of the community plugin to enable.
   */
  readonly pluginId: string;
}

// The `npm run dev`-owned Obsidian instance: launched on the first rebuild and reused across rebuilds.
// It is closed when the `npm run dev` process terminates (see `registerDevInstanceCleanup`).
let devInstanceTransportPromise: Promise<ObsidianTransport> | undefined;
let isDevInstanceCleanupRegistered = false;
let isDevInstanceDisposed = false;

/**
 * Creates an esbuild plugin that copies the build output to the Obsidian plugins folder.
 *
 * @param params - The parameters for the function.
 * @returns An esbuild `Plugin` object.
 */
export function copyToObsidianPluginsFolderPlugin(params: CopyToObsidianPluginsFolderPluginParams): Plugin {
  const {
    distFolder,
    isProductionBuild,
    pluginName
  } = params;
  let {
    obsidianConfigFolder
  } = params;
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

        await enableCommunityPlugin({
          obsidianConfigFolder,
          pluginId: 'hot-reload'
        });
        await enableCommunityPlugin({
          obsidianConfigFolder,
          pluginId: pluginName
        });
      });
    }
  };
}

/**
 * Enables a community plugin in the Obsidian configuration.
 *
 * @param params - The parameters for enabling the community plugin.
 * @returns A {@link Promise} that resolves when the plugin is enabled.
 */
async function enableCommunityPlugin(params: EnableCommunityPluginParams): Promise<void> {
  const { obsidianConfigFolder, pluginId } = params;
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

  const vaultPath = dirname(obsidianConfigFolder);

  // Live-enabling is best-effort: the plugin is already registered in `community-plugins.json`, so it is enabled on the next vault open even if this fails (and hot-reload picks up rebuilds meanwhile).
  try {
    const transport = await getOrLaunchDevInstance(vaultPath);
    await evalInObsidian({
      args: { pluginId },
      // eslint-disable-next-line no-shadow -- No actual shadowing as the function is executed externally.
      async fn({ app, pluginId }) {
        await app.plugins.enablePluginAndSave(pluginId);
      },
      shouldSkipPreflightChecks: true,
      transport,
      vaultPath
    });
  } catch (e: unknown) {
    getLibDebugger('copyToObsidianPluginsFolderPlugin')(`Failed to live-enable plugin '${pluginId}'. It will be enabled on the next vault open.`, e);
  }
}

/**
 * Returns the `npm run dev`-owned Obsidian instance for the given vault, launching it on first use and
 * reusing it on subsequent rebuilds.
 *
 * @param vaultPath - The absolute path to the vault folder to open.
 * @returns A {@link Promise} resolving to the owned {@link ObsidianTransport}.
 */
async function getOrLaunchDevInstance(vaultPath: string): Promise<ObsidianTransport> {
  devInstanceTransportPromise ??= launchDevInstance(vaultPath);
  try {
    return await devInstanceTransportPromise;
  } catch (e) {
    // Clear the cache so a later rebuild retries the launch.
    devInstanceTransportPromise = undefined;
    throw e;
  }
}

/**
 * Launches a fresh owned Obsidian instance (isolated user-data dir) and opens the given vault.
 *
 * @param vaultPath - The absolute path to the vault folder to open.
 * @returns A {@link Promise} resolving to the launched {@link ObsidianTransport}.
 */
async function launchDevInstance(vaultPath: string): Promise<ObsidianTransport> {
  const transport = await createTransportFromOptions();
  try {
    await transport.registerVault(vaultPath);
  } catch (e) {
    transport.disposeSync?.();
    throw e;
  }
  registerDevInstanceCleanup(transport);
  return transport;
}

/**
 * Registers process-exit and signal handlers (once) that synchronously close the owned Obsidian
 * instance when the `npm run dev` process terminates.
 *
 * @param transport - The owned transport to dispose on shutdown.
 */
function registerDevInstanceCleanup(transport: ObsidianTransport): void {
  if (isDevInstanceCleanupRegistered) {
    return;
  }
  isDevInstanceCleanupRegistered = true;

  // `exit` covers any `process.exit()`, but a default Ctrl+C terminates WITHOUT firing `exit`, so the signal handlers guarantee the owned Obsidian is killed on shutdown.
  process.on('exit', disposeDevInstance);
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      disposeDevInstance();
      process.exit();
    });
  }

  function disposeDevInstance(): void {
    if (isDevInstanceDisposed) {
      return;
    }
    isDevInstanceDisposed = true;
    transport.disposeSync?.();
  }
}

/* v8 ignore stop */
