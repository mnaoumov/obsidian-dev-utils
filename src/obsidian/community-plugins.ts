/**
 * @file
 *
 * Resolves and manages community plugins through Obsidian's public plugin registry and store-install
 * path.
 *
 * Obsidian's `community-plugins.json` is the authoritative source that maps a plugin `id` to its
 * `owner/name` GitHub repository — the plugin manifest itself carries no repository. This module uses
 * it to locate a plugin's GitHub releases (e.g. to download its shipped demo-vault archive) and to
 * install/uninstall/enable/disable an arbitrary community plugin by id via Obsidian's own store path
 * (`app.plugins.installPlugin` + `enablePluginAndSave`), so any dev/deploy or tooling flow can reuse it.
 */

import type {
  App,
  PluginManifest
} from 'obsidian';

import { requestUrl } from 'obsidian';

import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';

/**
 * Parameters for {@link disableCommunityPlugin}.
 */
export interface DisableCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The id of the community plugin to disable.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link enableCommunityPlugin}.
 */
export interface EnableCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The id of the community plugin to enable.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link installCommunityPlugin}.
 */
export interface InstallCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The id of the community plugin to install.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link toggleEnableCommunityPlugin}.
 */
export interface ToggleEnableCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The desired enabled state: `true` enables the plugin, `false` disables it.
   */
  readonly isEnabled: boolean;

  /**
   * The id of the community plugin to enable or disable.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link toggleInstallCommunityPlugin}.
 */
export interface ToggleInstallCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The desired installed state: `true` installs the plugin, `false` uninstalls it.
   */
  readonly isInstalled: boolean;

  /**
   * The id of the community plugin to install or uninstall.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link uninstallCommunityPlugin}.
 */
export interface UninstallCommunityPluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The id of the community plugin to uninstall.
   */
  readonly pluginId: string;
}

/**
 * A single entry in Obsidian's `community-plugins.json` registry.
 */
interface CommunityPluginEntry {
  /**
   * The plugin author.
   */
  readonly author: string;

  /**
   * The plugin description.
   */
  readonly description: string;

  /**
   * The plugin id.
   */
  readonly id: string;

  /**
   * The plugin display name.
   */
  readonly name: string;

  /**
   * The plugin's `owner/name` GitHub repository.
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

const COMMUNITY_PLUGINS_STATE_KEY = 'communityPluginEntriesPromise';
const COMMUNITY_PLUGINS_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json';

/**
 * Disables a community plugin (persisting the change) if it is currently enabled. Idempotent — a no-op
 * when the plugin is already disabled.
 *
 * @param params - The {@link DisableCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is disabled.
 */
export async function disableCommunityPlugin(params: DisableCommunityPluginParams): Promise<void> {
  const {
    app,
    pluginId
  } = params;
  if (!app.plugins.enabledPlugins.has(pluginId)) {
    return;
  }
  await app.plugins.disablePluginAndSave(pluginId);
}

/**
 * Enables a community plugin (persisting the change) if it is not already enabled. Idempotent — a no-op
 * when the plugin is already enabled.
 *
 * @param params - The {@link EnableCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is enabled.
 */
export async function enableCommunityPlugin(params: EnableCommunityPluginParams): Promise<void> {
  const {
    app,
    pluginId
  } = params;
  if (app.plugins.enabledPlugins.has(pluginId)) {
    return;
  }
  await app.plugins.enablePluginAndSave(pluginId);
}

/**
 * Resolves the `owner/name` GitHub repository of a community plugin from Obsidian's public
 * `community-plugins.json` registry.
 *
 * The registry is fetched once and cached on the shared plugin state for subsequent calls; a failed
 * fetch is not cached, so a later call retries.
 *
 * @param pluginId - The plugin id to look up.
 * @returns A {@link Promise} resolving to the plugin's `owner/name` repository, or `null` if the
 * plugin is not listed in the registry.
 */
export async function getCommunityPluginRepo(pluginId: string): Promise<null | string> {
  const cache = getObsidianDevUtilsState<null | Promise<CommunityPluginEntry[]>>(COMMUNITY_PLUGINS_STATE_KEY, null);
  cache.value ??= fetchCommunityPluginEntries();

  let entries: CommunityPluginEntry[];
  try {
    entries = await cache.value;
  } catch (error) {
    cache.value = null;
    throw error;
  }

  const entry = entries.find((candidate) => candidate.id === pluginId);
  return entry?.repo ?? null;
}

/**
 * Resolves the latest release version (the release `tag_name`, a bare version such as `1.2.3`) of a
 * GitHub repository.
 *
 * @param repo - The `owner/name` GitHub repository.
 * @returns A {@link Promise} resolving to the latest release version.
 */
export async function getLatestReleaseVersion(repo: string): Promise<string> {
  const response = await requestUrl(`https://api.github.com/repos/${repo}/releases/latest`);
  const release = response.json as GitHubRelease;
  return release.tag_name;
}

/**
 * Installs a community plugin from the official store if it is not already installed. Idempotent — a
 * no-op when the plugin is already installed. Resolves the plugin's repository from Obsidian's
 * community registry, reads the latest release version and its manifest, and installs it through
 * Obsidian's own `installPlugin` path.
 *
 * @param params - The {@link InstallCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is installed.
 * @throws If the plugin id is not listed in Obsidian's community plugins registry.
 */
export async function installCommunityPlugin(params: InstallCommunityPluginParams): Promise<void> {
  const {
    app,
    pluginId
  } = params;
  if (app.plugins.manifests[pluginId]) {
    return;
  }

  const repo = await getCommunityPluginRepo(pluginId);
  if (!repo) {
    throw new Error(`Plugin '${pluginId}' was not found in the Obsidian community plugins registry.`);
  }

  const version = await getLatestReleaseVersion(repo);
  const manifest = await getPluginManifest(repo, version);
  await app.plugins.installPlugin(repo, version, manifest);
}

/**
 * Enables or disables a community plugin to match the desired state. Delegates to
 * {@link enableCommunityPlugin} / {@link disableCommunityPlugin}, so it is idempotent.
 *
 * @param params - The {@link ToggleEnableCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin matches the desired enabled state.
 */
export async function toggleEnableCommunityPlugin(params: ToggleEnableCommunityPluginParams): Promise<void> {
  const {
    app,
    isEnabled,
    pluginId
  } = params;
  if (isEnabled) {
    await enableCommunityPlugin({ app, pluginId });
  } else {
    await disableCommunityPlugin({ app, pluginId });
  }
}

/**
 * Installs or uninstalls a community plugin to match the desired state. Delegates to
 * {@link installCommunityPlugin} / {@link uninstallCommunityPlugin}, so it is idempotent.
 *
 * @param params - The {@link ToggleInstallCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin matches the desired installed state.
 * @throws If installing and the plugin id is not listed in Obsidian's community plugins registry.
 */
export async function toggleInstallCommunityPlugin(params: ToggleInstallCommunityPluginParams): Promise<void> {
  const {
    app,
    isInstalled,
    pluginId
  } = params;
  if (isInstalled) {
    await installCommunityPlugin({ app, pluginId });
  } else {
    await uninstallCommunityPlugin({ app, pluginId });
  }
}

/**
 * Uninstalls a community plugin if it is currently installed. Idempotent — a no-op when the plugin is
 * not installed.
 *
 * @param params - The {@link UninstallCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is uninstalled.
 */
export async function uninstallCommunityPlugin(params: UninstallCommunityPluginParams): Promise<void> {
  const {
    app,
    pluginId
  } = params;
  if (!app.plugins.manifests[pluginId]) {
    return;
  }
  await app.plugins.uninstallPlugin(pluginId);
}

async function fetchCommunityPluginEntries(): Promise<CommunityPluginEntry[]> {
  const response = await requestUrl(COMMUNITY_PLUGINS_URL);
  return response.json as CommunityPluginEntry[];
}

async function getPluginManifest(repo: string, version: string): Promise<PluginManifest> {
  const response = await requestUrl(`https://github.com/${repo}/releases/download/${version}/manifest.json`);
  return response.json as PluginManifest;
}
