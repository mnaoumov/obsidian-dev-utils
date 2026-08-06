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
  DesktopCdpTransport,
  evalInObsidian
} from 'obsidian-integration-testing';

import {
  invokeAsyncSafely,
  sleep
} from '../../../async.ts';
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
 * The subset of a CDP target descriptor read from the owned instance's `/json` endpoint.
 */
interface CdpTarget {
  /**
   * The kind of the target, e.g. `page`.
   */
  readonly type: string;
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
// Its lifetime is tied to the `npm run dev` process in BOTH directions.
// The instance is closed when the process terminates (see `registerDevInstanceCleanup`).
// The process stops when the instance is closed (see `watchDevInstanceAndStopOnClose`).
/**
Module-level mutable state, held in one object so each mutation names it explicitly.
 */
interface ModuleState {
  devInstanceTransportPromise: Promise<ObsidianTransport> | undefined;
  isDevInstanceCleanupRegistered: boolean;
  isDevInstanceDisposed: boolean;
}

const moduleState: ModuleState = {
  devInstanceTransportPromise: undefined,
  isDevInstanceCleanupRegistered: false,
  isDevInstanceDisposed: false
};

/**
 * How often the owned Obsidian instance is probed to detect that it was closed.
 */
const DEV_INSTANCE_PROBE_INTERVAL_IN_MILLISECONDS = 2000;

/**
 * How many consecutive failed probes are tolerated before the owned instance is considered closed. A
 * single failure can be a transient hiccup (a busy renderer, a momentarily refused connection), so the
 * development build is only stopped once the endpoint stays unreachable.
 */
const DEV_INSTANCE_CLOSED_PROBE_COUNT = 3;
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
  moduleState.devInstanceTransportPromise ??= launchDevInstance(vaultPath);
  try {
    return await moduleState.devInstanceTransportPromise;
  } catch (error) {
    // Clear the cache so a later rebuild retries the launch.
    moduleState.devInstanceTransportPromise = undefined;
    throw error;
  }
}

/**
 * Installs the HotReload plugin from the official community store (if not already installed), loads it
 * (if not already running), and enables the freshly-built plugin — all through the `npm run dev`-owned
 * Obsidian instance, so HotReload then auto-refreshes the deployed plugin on every rebuild.
 *
 * The install goes through Obsidian's own `installPlugin` (the community-store mechanism), and every step
 * runs against the owned instance over CDP; any failure surfaces (the dev build reports it) rather than
 * being silently swallowed.
 *
 * The first step is leaving restricted mode for real, which the owned instance has only faked so far —
 * without it "enabled" and "loaded" come apart and none of the vault's plugins, HotReload included, are
 * running. See the comment on the `setEnable` call.
 *
 * The install-if-missing / enable-if-disabled logic below intentionally mirrors the public
 * `installCommunityPlugin` / `enableCommunityPlugin` helpers in `src/obsidian/community-plugins.ts`. It
 * cannot import and call them: the `fn` is serialized (`toString()`) and executed in the renderer, and
 * this build-owned Obsidian instance is bare — it has no dev-utils `lib` provider wired (that resolver is
 * registered only in the integration-test setup, whose fixture publishes the merged surface on `window`),
 * so the closure has no access to the library surface and must inline the equivalent steps.
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
    // eslint-disable-next-line unicorn/name-replacements -- `args` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
    args: { pluginName },
    // eslint-disable-next-line no-shadow, unicorn/name-replacements -- No actual shadowing as the function is executed externally, and `fn` is declared by `obsidian-integration-testing`.
    async fn({ app, obsidianModule, pluginName }) {
      const HOT_RELOAD_PLUGIN_ID = 'hot-reload';
      const COMMUNITY_PLUGINS_REGISTRY_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json';
      const { requestUrl } = obsidianModule;

      /*
       * Genuinely leave restricted mode before touching anything else. The owned instance boots with a
       * fresh user-data dir, so Obsidian starts restricted and `Plugins.initialize()` returns before
       * loading a single plugin. The harness then closes the trust modal and writes the
       * `enable-plugin-<appId>` localStorage flag directly — deliberately, to avoid a synchronous load —
       * which leaves `isEnabled()` reporting `true` over a vault where nothing is actually running. Every
       * `enabledPlugins` reading below (and in the mirrored `community-plugins.ts` helpers) would be
       * answering about the vault's config file rather than this instance.
       *
       * `setEnable(true)` is what Obsidian's own "Exit restricted mode" button calls: it re-asserts the
       * flag and loads everything in `enabledPlugins`. Unconditional on purpose — the flag is already
       * `true`, so an `isEnabled()` guard would skip the load that is the whole point. Idempotent and
       * effectively free once warm (`loadPlugin` returns the live instance), so re-running it on every
       * rebuild costs nothing.
       */
      await app.plugins.setEnable(true);

      if (!Object.hasOwn(app.plugins.manifests, HOT_RELOAD_PLUGIN_ID)) {
        const registryResponse = await requestUrl(COMMUNITY_PLUGINS_REGISTRY_URL);
        const registryEntries = registryResponse.json as CommunityPluginRegistryEntry[];
        const entry = registryEntries.find((candidate) => candidate.id === HOT_RELOAD_PLUGIN_ID);
        if (!entry) {
          throw new Error(`Plugin '${HOT_RELOAD_PLUGIN_ID}' was not found in the Obsidian community plugins registry.`);
        }

        const latestReleaseResponse = await requestUrl(`https://api.github.com/repos/${entry.repo}/releases/latest`);
        const latestRelease = latestReleaseResponse.json as GitHubRelease;
        const version = latestRelease.tag_name;
        const manifestResponse = await requestUrl(`https://github.com/${entry.repo}/releases/download/${version}/manifest.json`);
        const manifest = manifestResponse.json as PluginManifest;
        await app.plugins.installPlugin(entry.repo, version, manifest);
      }

      /*
       * Ask whether HotReload is RUNNING, not whether the vault config lists it as enabled. After the
       * `setEnable` above the two normally agree, but a HotReload that is listed and failed to load would
       * pass an `enabledPlugins` check while leaving the dev build without auto-refresh.
       */
      if (!Object.hasOwn(app.plugins.plugins, HOT_RELOAD_PLUGIN_ID)) {
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
 * Probes the owned Obsidian instance's CDP endpoint to determine whether it is still running.
 *
 * A closed instance stops serving CDP altogether, so an unreachable endpoint — or one left with no page
 * targets while the app tears itself down — means the instance is gone.
 *
 * @param cdpUrl - The base CDP URL of the owned instance, e.g. `http://localhost:51888`.
 * @returns A {@link Promise} resolving to `true` while the instance is still serving a page target.
 */
async function isDevInstanceRunning(cdpUrl: string): Promise<boolean> {
  try {
    // eslint-disable-next-line no-restricted-globals -- We run this outside of Obsidian, so we don't have `requestUrl()`.
    const response = await fetch(`${cdpUrl}/json`);
    const targets = await response.json() as CdpTarget[];
    return targets.some((target) => target.type === 'page');
  } catch {
    return false;
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
  } catch (error) {
    transport.disposeSync?.();
    throw error;
  }
  registerDevInstanceCleanup(transport);
  watchDevInstanceAndStopOnClose(transport);
  return transport;
}

/**
 * Registers process-exit and signal handlers (once) that synchronously close the owned Obsidian
 * instance when the `npm run dev` process terminates.
 *
 * These handlers cover an orderly shutdown. A `SIGKILL` (or a Task Manager / IDE stop) runs no handler
 * at all, and no operating system kills the instance just for being our child — so that case is caught
 * from the other side, by the harness's parent-liveness watchdog: the instance's renderer holds a socket
 * back to this process and destroys its window when the kernel closes it. See `parent-liveness.ts` in
 * `obsidian-integration-testing` (its L33).
 *
 * @param transport - The owned transport to dispose on shutdown.
 */
function registerDevInstanceCleanup(transport: ObsidianTransport): void {
  if (moduleState.isDevInstanceCleanupRegistered) {
    return;
  }
  moduleState.isDevInstanceCleanupRegistered = true;

  // `exit` covers any `process.exit()`, but a default Ctrl+C terminates WITHOUT firing `exit`, so the signal handlers guarantee the owned Obsidian is killed on shutdown.
  process.on('exit', disposeDevInstance);
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      disposeDevInstance();
      process.exit();
    });
  }

  function disposeDevInstance(): void {
    if (moduleState.isDevInstanceDisposed) {
      return;
    }
    moduleState.isDevInstanceDisposed = true;
    transport.disposeSync?.();
  }
}

/**
 * Watches the `npm run dev`-owned Obsidian instance and stops the development build once the instance is
 * closed.
 *
 * This is the mirror image of {@link registerDevInstanceCleanup}: that one closes the instance when the
 * `npm run dev` process terminates, this one terminates the process when the user closes the instance, so
 * the two never outlive each other. A build watching an Obsidian that is no longer running has nothing
 * left to deploy to.
 *
 * Only a harness-owned instance is watched. When the transport attaches to an already-running Obsidian
 * (the user's own), that instance is not ours to be tied to and closing it leaves the build running.
 *
 * @param transport - The owned transport whose instance to watch.
 */
function watchDevInstanceAndStopOnClose(transport: ObsidianTransport): void {
  if (!(transport instanceof DesktopCdpTransport)) {
    return;
  }

  const endpoint = transport.getOwnedInstanceEndpoint();
  if (!endpoint) {
    return;
  }

  const cdpUrl = `http://${endpoint.host}:${String(endpoint.port)}`;
  invokeAsyncSafely(stopWhenDevInstanceCloses);

  async function stopWhenDevInstanceCloses(): Promise<void> {
    let consecutiveFailedProbeCount = 0;
    while (consecutiveFailedProbeCount < DEV_INSTANCE_CLOSED_PROBE_COUNT) {
      await sleep({ milliseconds: DEV_INSTANCE_PROBE_INTERVAL_IN_MILLISECONDS });

      // The process is already shutting down and killed the instance itself; the probes would just race the teardown.
      if (moduleState.isDevInstanceDisposed) {
        return;
      }

      consecutiveFailedProbeCount = await isDevInstanceRunning(cdpUrl) ? 0 : consecutiveFailedProbeCount + 1;
    }

    console.warn('The Obsidian instance owned by `npm run dev` was closed. Stopping the development build.');
    process.exit();
  }
}

/* v8 ignore stop */
