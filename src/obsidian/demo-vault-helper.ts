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
 *
 * Finally it raises the sandbox notice explaining that the opened vault is a throwaway copy, so a user
 * who writes their own notes in it is never surprised by them being absent from the next copy.
 */

import type {
  App,
  DataAdapter
} from 'obsidian';

import { Notice } from 'obsidian';

import {
  basename,
  join
} from '../path.ts';
import { ensureNonNullable } from '../type-guards.ts';
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
 * The slice of the desktop vault adapter that knows the vault's absolute path.
 */
interface BasePathAdapter {
  /**
   * Returns the absolute path of the vault folder.
   */
  getBasePath(): string;
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
 * then runs the vault's `startup.ts`. Finally it raises the sandbox notice describing the opened vault
 * as a throwaway copy.
 *
 * @param params - The {@link BootstrapDemoVaultParams}.
 * @returns A {@link Promise} that resolves once CodeScript Toolkit is installed, configured, and enabled
 * and the sandbox notice has been shown.
 */
export async function bootstrapDemoVault(params: BootstrapDemoVaultParams): Promise<void> {
  const { app } = params;
  // Resolved BEFORE CodeScript Toolkit is installed. At release time the vault carries exactly two
  // Plugin folders — this helper and the plugin being demonstrated — so dropping the helper leaves the
  // Demonstrated one. Reading the folder later would also see CodeScript Toolkit and anything a demo
  // Note's prerequisites installed, leaving no way to tell which plugin the vault is for.
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
function buildSandboxNoticeFragment(pluginName: null | string, basePath: null | string): DocumentFragment {
  return createFragment((fragment) => {
    if (pluginName === null) {
      fragment.appendText('This is a demo vault.');
    } else {
      fragment.appendText('This is a demo vault for ');
      fragment.createEl('b', { text: pluginName });
      fragment.appendText('.');
    }

    fragment.appendText(' It is a temporary sandbox');
    if (basePath !== null) {
      fragment.appendText(' at ');
      fragment.createEl('code', { text: basePath });
    }
    fragment.appendText(', cleaned up automatically about a day after you last use it — copy anything you want to keep into your own vault. Running ');
    fragment.createEl('b', { text: pluginName === null ? OPEN_DEMO_VAULT_COMMAND_NAME : `${pluginName}: ${OPEN_DEMO_VAULT_COMMAND_NAME}` });
    fragment.appendText(' again creates a new copy with the latest plugin version, so your notes will not appear in it.');
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

// Identifies the plugin the vault demonstrates as the only installed plugin that is not this helper.
// Call it BEFORE anything else is installed (see `bootstrapDemoVault`). Any other count — a vault
// Opened after the plugin folder was hand-edited, or one that ships nothing but the helper — is
// Ambiguous, and an ambiguous answer becomes generic notice wording rather than a wrong plugin name.
async function getDemoedPluginId(app: App): Promise<null | string> {
  const pluginsFolderPath = join(app.vault.configDir, PLUGINS_FOLDER_NAME);
  if (!await app.vault.adapter.exists(pluginsFolderPath)) {
    return null;
  }

  const listedFiles = await app.vault.adapter.list(pluginsFolderPath);
  const demoedPluginIds = listedFiles.folders
    .map((folderPath) => basename(folderPath))
    .filter((pluginId) => pluginId !== DEMO_VAULT_HELPER_PLUGIN_ID);
  return demoedPluginIds.length === 1 ? ensureNonNullable(demoedPluginIds[0]) : null;
}

// Resolves the vault's absolute path for the notice. Only the desktop adapter knows it: `DataAdapter`
// Does not declare `getBasePath`, and `FileSystemAdapter` is a desktop-only class that is not guaranteed
// To exist elsewhere — so `instanceof` would throw rather than answer. It is reached instead through a
// Narrow hand-declared shape plus a runtime check (see L9). An adapter without it yields no path, and
// The notice then omits the sentence naming it rather than rendering `undefined`.
function getVaultBasePath(app: App): null | string {
  return isBasePathAdapter(app.vault.adapter) ? app.vault.adapter.getBasePath() : null;
}

function isBasePathAdapter(adapter: DataAdapter): adapter is BasePathAdapter & DataAdapter {
  return typeof Reflect.get(adapter, 'getBasePath') === 'function';
}

// Tells the user this vault is a sandbox, using Obsidian's own sandbox-vault treatment: an infinite
// Duration, dismissed by clicking it. Raised last, so it is the newest notice on screen once
// CodeScript Toolkit's startup script has done its own work.
function showSandboxNotice(app: App, demoedPluginId: null | string): void {
  const pluginName = demoedPluginId === null ? null : app.plugins.manifests[demoedPluginId]?.name ?? demoedPluginId;
  const fragment = buildSandboxNoticeFragment(pluginName, getVaultBasePath(app));
  new Notice(fragment, SANDBOX_NOTICE_DURATION_IN_MILLISECONDS);
}
