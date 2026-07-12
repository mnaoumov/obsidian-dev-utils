/**
 * @file
 *
 * Resolves a community plugin's GitHub repository from Obsidian's public plugin registry.
 *
 * Obsidian's `community-plugins.json` is the authoritative source that maps a plugin `id` to its
 * `owner/name` GitHub repository — the plugin manifest itself carries no repository. This is used to
 * locate a plugin's GitHub releases (e.g. to download its shipped demo-vault archive).
 */

import { requestUrl } from 'obsidian';

import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';

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

const COMMUNITY_PLUGINS_STATE_KEY = 'communityPluginEntriesPromise';
const COMMUNITY_PLUGINS_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json';

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

async function fetchCommunityPluginEntries(): Promise<CommunityPluginEntry[]> {
  const response = await requestUrl(COMMUNITY_PLUGINS_URL);
  return response.json as CommunityPluginEntry[];
}
