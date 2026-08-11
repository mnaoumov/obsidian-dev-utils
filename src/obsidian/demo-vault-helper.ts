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
 * The plugin the vault demonstrates is read from the helper's own `data.json`, written by the packaging
 * step ({@link DemoVaultHelperSettings}); a vault without that marker is refused as not a demo vault.
 *
 * It writes CodeScript Toolkit's settings BEFORE enabling it, so the plugin loads already configured —
 * no reload. CodeScript Toolkit then runs the vault's `startup.ts` (via its `startupScriptPath`
 * setting), which is where each vault opens its start note and does any plugin-specific setup.
 *
 * It also creates CodeScript Toolkit's invocable-scripts folder if it is missing, so every demo vault
 * has the same layout even when the vault ships no invocable scripts — the vaults themselves commit no
 * empty folder for it.
 *
 * Finally it raises the sandbox notice explaining that the opened vault is a throwaway copy, so a user
 * who writes their own notes in it is never surprised by them being absent from the next copy. Settings
 * is closed first, so the notice lands in the vault's main window rather than in the settings popout.
 */

import type { App } from 'obsidian';

import { Notice } from 'obsidian';

import type { DemoVaultHelperSettings } from './demo-vault-helper-settings.ts';

import { join } from '../path.ts';
import { EMPTY } from '../string.ts';
import {
  configureCommunityPlugin,
  ConfigureCommunityPluginResult,
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
   * The YAML frontmatter merged into every `code-button` block's own config, used here to turn the
   * source viewer on for every button in every demo vault without editing a single note.
   */
  readonly defaultCodeButtonConfig: string;

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
  defaultCodeButtonConfig: '---\nsourceVisibility: collapsed\n---',
  invocableScriptsFolder: 'Invocables',
  modulesRoot: CODE_SCRIPT_TOOLKIT_MODULES_ROOT,
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

const DEMO_VAULT_HELPER_PLUGIN_ID = 'demo-vault-helper';
const PLUGINS_FOLDER_NAME = 'plugins';
const DATA_JSON_FILE_NAME = 'data.json';
const INVALID_DEMO_VAULT_ERROR_MESSAGE = 'Invalid demo vault';
const OPEN_DEMO_VAULT_COMMAND_NAME = 'Open demo vault';
// `0` asks Obsidian to keep the notice up until the user clicks it — the same treatment Obsidian gives
// Its own sandbox-vault notice, and what the demo-vault notice is modelled on.
const SANDBOX_NOTICE_DURATION_IN_MILLISECONDS = 0;

/**
 * Bootstraps a demo vault so its notes' `code-button`s work with no manual setup: installs CodeScript
 * Toolkit from the community store (if it is not already installed), writes its settings, then enables
 * it — writing the settings BEFORE enabling so a fresh enable loads it already configured, with no
 * reload. If CodeScript Toolkit is already enabled but the settings just changed, it is reloaded
 * (disabled then enabled) so it re-reads `data.json`; when the settings were already in place, nothing is
 * reloaded (so a routine vault re-open does not re-run CodeScript Toolkit's startup). CodeScript Toolkit
 * then runs the vault's `startup.ts`. Finally it closes Settings (so the notice cannot be raised inside
 * the settings popout) and raises the sandbox notice describing the opened vault as a throwaway copy.
 *
 * @param params - The {@link BootstrapDemoVaultParams}.
 * @returns A {@link Promise} that resolves once CodeScript Toolkit is installed, configured, and enabled
 * and the sandbox notice has been shown.
 */
export async function bootstrapDemoVault(params: BootstrapDemoVaultParams): Promise<void> {
  const { app } = params;
  // Resolved first, so a vault that is not a demo vault is refused before anything is installed into it.
  const demoedPluginId = await getDemoedPluginId(app);
  await installCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  const result = await configureCommunityPlugin({
    app,
    pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID,
    settings: CODE_SCRIPT_TOOLKIT_SETTINGS
  });
  await ensureInvocableScriptsFolder(app);

  if (!app.plugins.enabledPlugins.has(CODE_SCRIPT_TOOLKIT_PLUGIN_ID)) {
    await enableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  } else if (result === ConfigureCommunityPluginResult.Success) {
    // Already enabled with stale settings — reload so CodeScript Toolkit re-reads the freshly written data.json.
    await disableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
    await enableCommunityPlugin({ app, pluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID });
  }

  showSandboxNotice(app, demoedPluginId);
}

// Builds the sandbox notice content: what this vault is, where it lives, how long it lives, and why
// Re-running the command produces a vault without the notes just written here.
//
// Every claim has to stay true of the opener (`desktop-demo-vault-opener.ts`): it extracts a FRESH copy
// Into its own folder on every open, and deletes extracted folders older than a day on each later open.
// So the vault is a temporary sandbox — it must never be described as a place work can be left.
function buildSandboxNoticeFragment(pluginName: string): DocumentFragment {
  return createFragment((fragment) => {
    fragment.appendText('This is a demo vault for ');
    fragment.createEl('b', { text: pluginName });
    fragment.appendText('.');

    fragment.createEl('br');
    fragment.appendText('It is a temporary sandbox, cleaned up automatically about a day after you last use it.');

    fragment.createEl('br');
    fragment.appendText('Executing ');
    fragment.createEl('b', { text: `${pluginName}: ${OPEN_DEMO_VAULT_COMMAND_NAME}` });
    fragment.appendText(' command again creates a new copy with the latest plugin version, so your notes will not appear in it.');
  });
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

// Reads the plugin the vault demonstrates out of this helper's own `data.json`, written by the
// Packaging step (see `DemoVaultHelperSettings`). A vault without a readable marker was not produced by
// That step — hand-assembled, or unpacked from something that is not a demo vault — so it is refused
// Rather than bootstrapped against a guess.
async function getDemoedPluginId(app: App): Promise<string> {
  const settingsPath = join(app.vault.configDir, PLUGINS_FOLDER_NAME, DEMO_VAULT_HELPER_PLUGIN_ID, DATA_JSON_FILE_NAME);
  if (!await app.vault.adapter.exists(settingsPath)) {
    throw new Error(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await app.vault.adapter.read(settingsPath));
  } catch (error) {
    throw new Error(INVALID_DEMO_VAULT_ERROR_MESSAGE, { cause: error });
  }

  const demoedPluginId = (parsed as null | Partial<DemoVaultHelperSettings>)?.demoedPluginId;
  if (typeof demoedPluginId !== 'string' || demoedPluginId === EMPTY) {
    throw new Error(INVALID_DEMO_VAULT_ERROR_MESSAGE);
  }
  return demoedPluginId;
}

// Tells the user this vault is a sandbox, using Obsidian's own sandbox-vault treatment: an infinite
// Duration, dismissed by clicking it. Raised last, so it is the newest notice on screen once
// CodeScript Toolkit's startup script has done its own work.
//
// A `Notice` is built inside whatever window is active at that moment, and Settings is a POPOUT WINDOW
// (verified on 1.13.6) that becomes the active one while it is open — so a notice raised then would be
// Created in the settings window and vanish with it. Settings is therefore closed first: Obsidian hands
// The main window back as the popout goes away (synchronously, before the notice is built), and a user
// Who has just opened a demo vault wants to see the vault rather than a settings window anyway. Closing
// An already-closed Settings is a no-op, so no open-state probe is needed.
function showSandboxNotice(app: App, demoedPluginId: string): void {
  const pluginName = app.plugins.manifests[demoedPluginId]?.name ?? demoedPluginId;
  const fragment = buildSandboxNoticeFragment(pluginName);
  app.setting.close();
  new Notice(fragment, SANDBOX_NOTICE_DURATION_IN_MILLISECONDS);
}
