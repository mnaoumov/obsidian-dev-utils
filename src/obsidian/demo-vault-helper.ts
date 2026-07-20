/**
 * @file
 *
 * Bootstraps a demo vault by installing, configuring, and enabling CodeScript Toolkit.
 *
 * A plugin's demo vault showcases the plugin through notes whose `code-button`s run TypeScript via
 * CodeScript Toolkit. A demo vault that does not itself ship CodeScript Toolkit therefore needs it
 * installed, configured, and enabled before those buttons work. {@link bootstrapDemoVault} does exactly
 * that with no committed CodeScript Toolkit config and no manual setup, so it can be driven from a tiny
 * committed bootstrap plugin (`demo-vault-helper`) that is injected into every demo vault at release
 * time.
 *
 * It writes CodeScript Toolkit's settings BEFORE enabling it, so the plugin loads already configured —
 * no reload. CodeScript Toolkit then runs the vault's `startup.ts` (via its `startupScriptPath`
 * setting), which is where each vault opens its start note and does any plugin-specific setup.
 *
 * It also creates CodeScript Toolkit's invocable-scripts folder if it is missing, so every demo vault
 * has the same layout even when the vault ships no invocable scripts — the vaults themselves commit no
 * empty folder for it.
 */

import type { App } from 'obsidian';

import { join } from '../path.ts';
import {
  configureCommunityPlugin,
  disableCommunityPlugin,
  enableCommunityPlugin,
  installCommunityPlugin
} from './community-plugins.ts';

/**
 * Parameters for {@link bootstrapDemoVault}.
 */
export interface BootstrapDemoVaultParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;
}

/**
 * CodeScript Toolkit's settings, written into its `data.json` before it is enabled.
 */
interface CodeScriptToolkitSettings {
  /**
   * The folder (under {@link CodeScriptToolkitSettings.modulesRoot}) holding invocable scripts.
   */
  readonly invocableScriptsFolder: string;

  /**
   * The vault-relative folder that `require('/…')` resolves module paths against.
   */
  readonly modulesRoot: string;

  /**
   * Whether CodeScript Toolkit handles `obsidian://` protocol URLs.
   */
  readonly shouldHandleProtocolUrls: boolean;

  /**
   * The path (under {@link CodeScriptToolkitSettings.modulesRoot}) of the script run on load.
   */
  readonly startupScriptPath: string;
}

const CODE_SCRIPT_TOOLKIT_PLUGIN_ID = 'fix-require-modules';
const CODE_SCRIPT_TOOLKIT_MODULES_ROOT = '_assets/CodeScriptToolkit';
const CODE_SCRIPT_TOOLKIT_SETTINGS: CodeScriptToolkitSettings = {
  invocableScriptsFolder: 'Invocables',
  modulesRoot: CODE_SCRIPT_TOOLKIT_MODULES_ROOT,
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

/**
 * Bootstraps a demo vault so its notes' `code-button`s work with no manual setup: installs CodeScript
 * Toolkit from the community store (if it is not already installed), writes its settings, then enables
 * it — writing the settings BEFORE enabling so a fresh enable loads it already configured, with no
 * reload. If CodeScript Toolkit is already enabled but the settings just changed, it is reloaded
 * (disabled then enabled) so it re-reads `data.json`; when the settings were already in place, nothing is
 * reloaded (so a routine vault re-open does not re-run CodeScript Toolkit's startup). CodeScript Toolkit
 * then runs the vault's `startup.ts`.
 *
 * @param params - The {@link BootstrapDemoVaultParams}.
 * @returns A {@link Promise} that resolves once CodeScript Toolkit is installed, configured, and enabled.
 */
export async function bootstrapDemoVault(params: BootstrapDemoVaultParams): Promise<void> {
  const { app } = params;
  await installCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  const didSettingsChange = await configureCommunityPlugin({
    app,
    pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID,
    settings: CODE_SCRIPT_TOOLKIT_SETTINGS
  });
  await ensureInvocableScriptsFolder(app);

  if (!app.plugins.enabledPlugins.has(CODE_SCRIPT_TOOLKIT_PLUGIN_ID)) {
    await enableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  } else if (didSettingsChange) {
    // Already enabled with stale settings — reload so CodeScript Toolkit re-reads the freshly written data.json.
    await disableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
    await enableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  }
}

// Creates CodeScript Toolkit's invocable-scripts folder (under `modulesRoot`) if it is missing.
// Every demo vault then has the same CodeScript Toolkit layout even when it ships no invocable scripts.
// The committed vault therefore carries no otherwise-empty placeholder folder.
async function ensureInvocableScriptsFolder(app: App): Promise<void> {
  const invocableScriptsFolderPath = join(CODE_SCRIPT_TOOLKIT_MODULES_ROOT, CODE_SCRIPT_TOOLKIT_SETTINGS.invocableScriptsFolder);
  if (!await app.vault.adapter.exists(invocableScriptsFolderPath)) {
    await app.vault.adapter.mkdir(invocableScriptsFolderPath);
  }
}
