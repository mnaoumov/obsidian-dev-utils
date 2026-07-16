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
import type { PluginManifest } from 'obsidian';
import type { ObsidianTransport } from 'obsidian-integration-testing';

import {
  cp,
  mkdir
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
 * A single entry in Obsidian's community plugins registry (`community-plugins.json`).
 */
interface CommunityPluginRegistryEntry {
  /**
   * The plugin id.
   */
  readonly id: string;

  /**
   * The `owner/name` GitHub repository the plugin is published from.
   */
  readonly repo: string;
}

/**
 * The subset of a GitHub release we read.
 */
interface GitHubRelease {
  /**
   * The release tag, a bare version such as `1.2.3`.
   */
  readonly tag_name: string;
}

/**
 * Parameters for {@link installAndEnableHotReload}.
 */
interface InstallAndEnableHotReloadParams {
  /**
   * The folder of the Obsidian configuration.
   */
  readonly obsidianConfigFolder: string;

  /**
   * The name of the built Obsidian plugin to enable once HotReload is in place.
   */
  readonly pluginName: string;
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
        await mkdir(pluginFolder, { recursive: true });
        await cp(distFolder, pluginFolder, { recursive: true });

        await installAndEnableHotReload({
          obsidianConfigFolder,
          pluginName
        });
      });
    }
  };
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
 * Installs the HotReload plugin from the official community store (if not already installed), enables it
 * (if not already enabled), and enables the freshly-built plugin — all through the `npm run dev`-owned
 * Obsidian instance, so HotReload then auto-refreshes the deployed plugin on every rebuild.
 *
 * The install goes through Obsidian's own `installPlugin` (the community-store mechanism), and every step
 * runs against the owned instance over CDP; any failure surfaces (the dev build reports it) rather than
 * being silently swallowed.
 *
 * @param params - The {@link InstallAndEnableHotReloadParams}.
 * @returns A {@link Promise} that resolves once HotReload and the built plugin are installed and enabled.
 */
async function installAndEnableHotReload(params: InstallAndEnableHotReloadParams): Promise<void> {
  const {
    obsidianConfigFolder,
    pluginName
  } = params;
  const vaultPath = dirname(obsidianConfigFolder);
  const transport = await getOrLaunchDevInstance(vaultPath);
  await evalInObsidian({
    args: { pluginName },
    // eslint-disable-next-line no-shadow -- No actual shadowing as the function is executed externally.
    async fn({ app, obsidianModule, pluginName }) {
      const HOT_RELOAD_PLUGIN_ID = 'hot-reload';
      const COMMUNITY_PLUGINS_REGISTRY_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json';
      const { requestUrl } = obsidianModule;

      if (!app.plugins.manifests[HOT_RELOAD_PLUGIN_ID]) {
        const registryEntries = (await requestUrl(COMMUNITY_PLUGINS_REGISTRY_URL)).json as CommunityPluginRegistryEntry[];
        const entry = registryEntries.find((candidate) => candidate.id === HOT_RELOAD_PLUGIN_ID);
        if (!entry) {
          throw new Error(`Plugin '${HOT_RELOAD_PLUGIN_ID}' was not found in the Obsidian community plugins registry.`);
        }

        const latestRelease = (await requestUrl(`https://api.github.com/repos/${entry.repo}/releases/latest`)).json as GitHubRelease;
        const version = latestRelease.tag_name;
        const manifest = (await requestUrl(`https://github.com/${entry.repo}/releases/download/${version}/manifest.json`)).json as PluginManifest;
        await app.plugins.installPlugin(entry.repo, version, manifest);
      }

      if (!app.plugins.enabledPlugins.has(HOT_RELOAD_PLUGIN_ID)) {
        await app.plugins.enablePluginAndSave(HOT_RELOAD_PLUGIN_ID);
      }

      await app.plugins.enablePluginAndSave(pluginName);
    },
    shouldSkipPreflightChecks: true,
    transport,
    vaultPath
  });
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
