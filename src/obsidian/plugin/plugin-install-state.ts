/**
 * @file
 *
 * How another plugin is present in this vault, and the one-click path to making it present.
 *
 * Shared by the two components that ask a user to bring another plugin in: `PluginSuggestionComponent`,
 * which OFFERS one and keeps working without it, and `PluginDependenciesComponent`, which REQUIRES one and
 * does nothing until it is there. The offer and the requirement differ in what they do about the answer,
 * not in how they read the state or how they install — so that part lives here rather than in both.
 */

import type { App } from 'obsidian';

import type { PluginNoticeComponent } from '../components/plugin-notice-component.ts';

import {
  enableCommunityPlugin,
  installConfigureEnableCommunityPlugin
} from '../community-plugins.ts';
import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '../html-element.ts';
import { t } from '../i18n/i18n.ts';

/**
 * How another plugin is currently present in the vault.
 */
export enum InstalledPluginState {
  /**
   * Installed and enabled — there is nothing to do.
   */
  Enabled = 'enabled',

  /**
   * Installed but disabled. Only an enable is needed, so no download happens.
   */
  InstalledButDisabled = 'installedButDisabled',

  /**
   * Not installed at all.
   */
  NotInstalled = 'notInstalled'
}

/**
 * Parameters for {@link getInstalledPluginState}.
 */
export interface GetInstalledPluginStateParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The `manifest.id` of the plugin to look for.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link installAndEnablePlugin}.
 */
export interface InstallAndEnablePluginParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The `manifest.id` of the plugin to install and enable.
   */
  readonly pluginId: string;

  /**
   * The display name of the plugin, shown to the user.
   */
  readonly pluginName: string;

  /**
   * The notice component of the plugin doing the asking, used to report the outcome.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

/**
 * Resolves how another plugin is currently present in the vault.
 *
 * @param params - The {@link GetInstalledPluginStateParams}.
 * @returns The {@link InstalledPluginState}.
 */
export function getInstalledPluginState(params: GetInstalledPluginStateParams): InstalledPluginState {
  const { app, pluginId } = params;

  if (app.plugins.enabledPlugins.has(pluginId)) {
    return InstalledPluginState.Enabled;
  }

  return Object.hasOwn(app.plugins.manifests, pluginId)
    ? InstalledPluginState.InstalledButDisabled
    : InstalledPluginState.NotInstalled;
}

/**
 * Installs (when needed) and enables another plugin, reporting the outcome as a notice.
 *
 * A no-op when the plugin is already enabled, so a caller reacting to a click need not check first.
 *
 * @param params - The {@link InstallAndEnablePluginParams}.
 * @returns A {@link Promise} that resolves once the plugin is enabled.
 * @throws Whatever the install or enable threw, after reporting it as a notice — the caller decides
 * whether a failure is worth more than the notice the user has already seen.
 */
export async function installAndEnablePlugin(params: InstallAndEnablePluginParams): Promise<void> {
  const {
    app,
    pluginId,
    pluginName,
    pluginNoticeComponent
  } = params;
  const state = getInstalledPluginState({ app, pluginId });

  if (state === InstalledPluginState.Enabled) {
    return;
  }

  try {
    if (state === InstalledPluginState.InstalledButDisabled) {
      await enableCommunityPlugin({ app, pluginId });
    } else {
      await installConfigureEnableCommunityPlugin({ app, pluginId });
    }
  } catch (error) {
    pluginNoticeComponent.showNotice(createFragmentWithCodeBlocks(
      t(($) => $.obsidianDevUtils.pluginSuggestion.installFailed, { pluginName: asCodeBlock(pluginName) })
    ));
    throw error;
  }

  pluginNoticeComponent.showNotice(createFragmentWithCodeBlocks(
    t(($) => $.obsidianDevUtils.pluginSuggestion.installed, { pluginName: asCodeBlock(pluginName) })
  ));
}
