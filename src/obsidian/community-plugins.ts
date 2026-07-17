/**
 * @file
 *
 * Resolves, searches and manages community plugins through Obsidian's public plugin registry and
 * store-install path.
 *
 * Obsidian's `community-plugins.json` is the authoritative source that maps a plugin `id` to its
 * `owner/name` GitHub repository — the plugin manifest itself carries no repository. This module uses
 * it to search the registry, to locate a plugin's GitHub releases (e.g. to download its shipped
 * demo-vault archive), and to install/uninstall/enable/disable an arbitrary community plugin — selected
 * by either its `id` or its display `name` — via Obsidian's own store path (`app.plugins.installPlugin`
 * + `enablePluginAndSave`), so any dev/deploy or tooling flow can reuse it.
 */

import type {
  App,
  PluginManifest
} from 'obsidian';

import { requestUrl } from 'obsidian';

import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';

/**
 * Selects a community plugin either by its id ({@link CommunityPluginByIdRef}) or by its display name
 * ({@link CommunityPluginByNameRef}).
 */
export type CommunityPluginRef = CommunityPluginByIdRef | CommunityPluginByNameRef;

/**
 * A single result of {@link searchCommunityPlugins}.
 */
export interface CommunityPluginSearchResult {
  /**
   * The plugin id.
   */
  readonly id: string;

  /**
   * The plugin display name.
   */
  readonly name: string;
}

/**
 * Parameters for {@link configureCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type ConfigureCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef & CommunityPluginSettings;

/**
 * Parameters for {@link disableCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type DisableCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef;

/**
 * Parameters for {@link enableCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type EnableCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef;

/**
 * Parameters for {@link installCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type InstallCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef;

/**
 * Parameters for {@link toggleEnableCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type ToggleEnableCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef & CommunityPluginToggleEnableState;

/**
 * Parameters for {@link toggleInstallCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type ToggleInstallCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef & CommunityPluginToggleInstallState;

/**
 * Parameters for {@link uninstallCommunityPlugin}. Selects the plugin by either `pluginId` or
 * `pluginName`.
 */
export type UninstallCommunityPluginParams = CommunityPluginOperationContext & CommunityPluginRef;

/**
 * Selects a community plugin by its id.
 */
interface CommunityPluginByIdRef {
  /**
   * The plugin id.
   */
  readonly pluginId: string;
}

/**
 * Selects a community plugin by its display name (as listed in Obsidian's community registry).
 */
interface CommunityPluginByNameRef {
  /**
   * The plugin display name.
   */
  readonly pluginName: string;
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
 * The Obsidian app instance a community-plugin operation runs against.
 */
interface CommunityPluginOperationContext {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;
}

/**
 * The settings to merge into a community plugin's `data.json`.
 */
interface CommunityPluginSettings {
  /**
   * The settings object shallow-merged over the plugin's existing `data.json` (the file is created if
   * absent).
   */
  readonly settings: object;
}

/**
 * The desired enabled state for {@link toggleEnableCommunityPlugin}.
 */
interface CommunityPluginToggleEnableState {
  /**
   * The desired enabled state: `true` enables the plugin, `false` disables it.
   */
  readonly isEnabled: boolean;
}

/**
 * The desired installed state for {@link toggleInstallCommunityPlugin}.
 */
interface CommunityPluginToggleInstallState {
  /**
   * The desired installed state: `true` installs the plugin, `false` uninstalls it.
   */
  readonly isInstalled: boolean;
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
const DATA_JSON_INDENT = 2;

/**
 * Writes settings into a community plugin's `data.json`, shallow-merging them over any existing settings
 * (creating the file if absent). Writing settings BEFORE the plugin is enabled makes it load already
 * configured, with no reload.
 *
 * @param params - The {@link ConfigureCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the settings are written.
 * @throws If selected by `pluginName` and the name is not listed in Obsidian's community plugins registry.
 */
export async function configureCommunityPlugin(params: ConfigureCommunityPluginParams): Promise<void> {
  const { app, settings } = params;
  const pluginId = await resolveCommunityPluginId(params);
  const dataPath = `${app.vault.configDir}/plugins/${pluginId}/data.json`;

  let data: object = {};
  if (await app.vault.adapter.exists(dataPath)) {
    const parsed: unknown = JSON.parse(await app.vault.adapter.read(dataPath));
    if (parsed !== null && typeof parsed === 'object') {
      data = parsed;
    }
  }

  Object.assign(data, settings);
  const serialized = JSON.stringify(data, null, DATA_JSON_INDENT) ?? '';
  await app.vault.adapter.write(dataPath, `${serialized}\n`);
}

/**
 * Disables a community plugin (persisting the change) if it is currently enabled. Idempotent — a no-op
 * when the plugin is already disabled.
 *
 * @param params - The {@link DisableCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is disabled.
 * @throws If selected by `pluginName` and the name is not listed in Obsidian's community plugins registry.
 */
export async function disableCommunityPlugin(params: DisableCommunityPluginParams): Promise<void> {
  const { app } = params;
  const pluginId = await resolveCommunityPluginId(params);
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
 * @throws If selected by `pluginName` and the name is not listed in Obsidian's community plugins registry.
 */
export async function enableCommunityPlugin(params: EnableCommunityPluginParams): Promise<void> {
  const { app } = params;
  const pluginId = await resolveCommunityPluginId(params);
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
  const entries = await getCommunityPluginEntries();
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
 * @throws If the plugin is not listed in Obsidian's community plugins registry.
 */
export async function installCommunityPlugin(params: InstallCommunityPluginParams): Promise<void> {
  const { app } = params;
  const pluginId = await resolveCommunityPluginId(params);
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
 * Searches Obsidian's public community plugins registry, returning the id and display name of every
 * plugin whose id, name, author or description contains the query (case-insensitive). An empty query
 * matches every plugin.
 *
 * @param query - The search query.
 * @returns A {@link Promise} resolving to the matching plugins' {@link CommunityPluginSearchResult}s.
 */
export async function searchCommunityPlugins(query: string): Promise<CommunityPluginSearchResult[]> {
  const entries = await getCommunityPluginEntries();
  const normalizedQuery = query.toLowerCase();
  return entries
    .filter((entry) =>
      entry.id.toLowerCase().includes(normalizedQuery)
      || entry.name.toLowerCase().includes(normalizedQuery)
      || entry.author.toLowerCase().includes(normalizedQuery)
      || entry.description.toLowerCase().includes(normalizedQuery)
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name
    }));
}

/**
 * Enables or disables a community plugin to match the desired state. Delegates to
 * {@link enableCommunityPlugin} / {@link disableCommunityPlugin}, so it is idempotent.
 *
 * @param params - The {@link ToggleEnableCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin matches the desired enabled state.
 * @throws If selected by `pluginName` and the name is not listed in Obsidian's community plugins registry.
 */
export async function toggleEnableCommunityPlugin(params: ToggleEnableCommunityPluginParams): Promise<void> {
  if (params.isEnabled) {
    await enableCommunityPlugin(params);
  } else {
    await disableCommunityPlugin(params);
  }
}

/**
 * Installs or uninstalls a community plugin to match the desired state. Delegates to
 * {@link installCommunityPlugin} / {@link uninstallCommunityPlugin}, so it is idempotent.
 *
 * @param params - The {@link ToggleInstallCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin matches the desired installed state.
 * @throws If installing and the plugin is not listed in Obsidian's community plugins registry.
 */
export async function toggleInstallCommunityPlugin(params: ToggleInstallCommunityPluginParams): Promise<void> {
  if (params.isInstalled) {
    await installCommunityPlugin(params);
  } else {
    await uninstallCommunityPlugin(params);
  }
}

/**
 * Uninstalls a community plugin if it is currently installed. Idempotent — a no-op when the plugin is
 * not installed.
 *
 * @param params - The {@link UninstallCommunityPluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is uninstalled.
 * @throws If selected by `pluginName` and the name is not listed in Obsidian's community plugins registry.
 */
export async function uninstallCommunityPlugin(params: UninstallCommunityPluginParams): Promise<void> {
  const { app } = params;
  const pluginId = await resolveCommunityPluginId(params);
  if (!app.plugins.manifests[pluginId]) {
    return;
  }
  await app.plugins.uninstallPlugin(pluginId);
}

async function fetchCommunityPluginEntries(): Promise<CommunityPluginEntry[]> {
  const response = await requestUrl(COMMUNITY_PLUGINS_URL);
  return response.json as CommunityPluginEntry[];
}

async function getCommunityPluginEntries(): Promise<CommunityPluginEntry[]> {
  const cache = getObsidianDevUtilsState<null | Promise<CommunityPluginEntry[]>>(COMMUNITY_PLUGINS_STATE_KEY, null);
  cache.value ??= fetchCommunityPluginEntries();

  try {
    return await cache.value;
  } catch (error) {
    cache.value = null;
    throw error;
  }
}

async function getPluginManifest(repo: string, version: string): Promise<PluginManifest> {
  const response = await requestUrl(`https://github.com/${repo}/releases/download/${version}/manifest.json`);
  return response.json as PluginManifest;
}

async function resolveCommunityPluginId(ref: CommunityPluginRef): Promise<string> {
  if ('pluginId' in ref) {
    return ref.pluginId;
  }

  const entries = await getCommunityPluginEntries();
  const entry = entries.find((candidate) => candidate.name === ref.pluginName);
  if (!entry) {
    throw new Error(`Plugin named '${ref.pluginName}' was not found in the Obsidian community plugins registry.`);
  }
  return entry.id;
}
