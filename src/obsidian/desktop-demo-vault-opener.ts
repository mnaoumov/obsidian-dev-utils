/**
 * @file
 *
 * Downloads and opens a plugin's shipped demo vault in a new Obsidian window (desktop only).
 *
 * A plugin can attach a `<plugin-id>-demo-vault-<version>.zip` archive to each GitHub release (see
 * `archivePluginDemoVault` in `script-utils/demo-vault.ts`). This resolves the plugin's repository
 * from Obsidian's community registry, downloads the archive for the chosen version, and opens it as a
 * vault in a new window. When the installed plugin version is behind the latest release, the user is
 * offered a choice between the two versions.
 *
 * A progress notice is shown immediately (download + extraction can take a while, so the user must see
 * something is happening right away). Only the downloaded ARCHIVE is cached (under the OS temp
 * directory); every invocation extracts a FRESH copy into its own temporary folder and opens that, so a
 * previous session's edits never leak into a new one. The extracted vault folder is named
 * `<plugin-id>-<version>.demo-vault` so it reads nicely in Obsidian's vault switcher. Orphaned
 * extracted folders left over from earlier sessions are cleaned up (best-effort) on each open.
 */

import type { App } from 'obsidian';

import AdmZip from 'adm-zip';
import { compareVersions } from 'compare-versions';
/* eslint-disable import-x/no-nodejs-modules -- Desktop-only feature gated by `Platform.isDesktopApp`; the command is hidden on mobile so these Node APIs are never reached there. */
import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
/* eslint-enable import-x/no-nodejs-modules -- Desktop-only feature gated by `Platform.isDesktopApp`; the command is hidden on mobile so these Node APIs are never reached there. */
import { requestUrl } from 'obsidian';

import type {
  PluginNoticeComponent,
  PluginNoticeComponentDelayedNotice
} from './components/plugin-notice-component.ts';

import { join } from '../path.ts';
import {
  getCommunityPluginRepo,
  getLatestReleaseVersion
} from './community-plugins.ts';
import { selectOption } from './modals/select-option.ts';

/**
 * Parameters for {@link openDemoVault}.
 */
export interface OpenDemoVaultParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The plugin id, used to locate the GitHub repository, to name the archive asset, and to name the
   * cached archive and the extracted vault folder.
   */
  readonly pluginId: string;

  /**
   * The plugin display name, used to label the notices and the version-choice dialog.
   */
  readonly pluginName: string;

  /**
   * The notice component used to report progress and problems (plugin not in the registry, missing
   * archive).
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * The currently installed plugin version, offered as one of the version choices.
   */
  readonly pluginVersion: string;
}

interface ExtractDemoVaultToFreshFolderParams {
  readonly archive: Buffer;
  readonly pluginId: string;
  readonly version: string;
}

interface ResolveDemoVaultArchiveParams {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly progressNotice: PluginNoticeComponentDelayedNotice;
  readonly repo: string;
  readonly version: string;
}

const DEMO_VAULTS_CACHE_FOLDER = 'obsidian-demo-vaults';
const ARCHIVES_SUBFOLDER = 'archives';
const EXTRACTED_VAULTS_SUBFOLDER = 'extracted';
const HTTP_STATUS_OK = 200;
// One day in milliseconds (24 * 60 * 60 * 1000).
const ORPHANED_EXTRACTED_VAULT_MAX_AGE_IN_MILLISECONDS = 86_400_000;

/**
 * Downloads and opens the plugin's demo vault in a new Obsidian window. Desktop only.
 *
 * If the installed plugin version is the latest (or newer), its demo vault opens directly; otherwise
 * the user chooses between the latest and the currently-installed version. A progress notice is shown
 * immediately. The chosen version's archive is downloaded once (then reused from the archive cache),
 * but a fresh copy is extracted into its own temporary folder on every open — the vault is never reused
 * across sessions.
 *
 * @param params - The {@link OpenDemoVaultParams}.
 * @returns A {@link Promise} that resolves once the vault has been opened, or once the operation has
 * been reported as not possible (notice shown) or cancelled by the user.
 */
export async function openDemoVault(params: OpenDemoVaultParams): Promise<void> {
  const {
    app,
    pluginId,
    pluginName,
    pluginNoticeComponent,
    pluginVersion
  } = params;

  // Shown immediately (`delayInMilliseconds: 0`): resolving the release, downloading and extracting can
  // Each take a while, so the user must see progress the moment the command is invoked.
  using progressNotice = pluginNoticeComponent.showNoticeAfterDelay({
    content: `Opening demo vault for ${pluginName}…`,
    delayInMilliseconds: 0
  });

  const repo = await getCommunityPluginRepo(pluginId);
  if (!repo) {
    pluginNoticeComponent.showNotice(`Could not find plugin ${pluginName} in the community plugins registry.`);
    return;
  }

  const currentVersion = pluginVersion;
  const latestVersion = await getLatestReleaseVersion(repo);

  let versionToOpen: string;
  if (compareVersions(currentVersion, latestVersion) >= 0) {
    versionToOpen = currentVersion;
  } else {
    const chosenVersion = await selectOption<null | string>({
      app,
      message: `Current version of plugin ${pluginName} v${currentVersion} is not the latest (v${latestVersion})`,
      options: [
        {
          isCta: true,
          text: `Open demo vault for latest version (v${latestVersion})`,
          value: latestVersion
        },
        {
          text: `Open demo vault for current version (v${currentVersion})`,
          value: currentVersion
        },
        {
          text: 'Cancel',
          value: null
        }
      ],
      title: pluginName
    });
    if (chosenVersion === null) {
      return;
    }
    versionToOpen = chosenVersion;
  }

  const archive = await resolveDemoVaultArchive({
    pluginId,
    pluginName,
    pluginNoticeComponent,
    progressNotice,
    repo,
    version: versionToOpen
  });
  if (!archive) {
    return;
  }

  progressNotice.setContent(`Extracting demo vault for ${pluginName} v${versionToOpen}…`);
  cleanupOrphanedExtractedVaults();
  const vaultDir = extractDemoVaultToFreshFolder({
    archive,
    pluginId,
    version: versionToOpen
  });

  window.electron.ipcRenderer.sendSync('vault-open', vaultDir, false);
}

/**
 * Removes extracted demo-vault folders left over from earlier sessions (best-effort).
 *
 * Every open extracts a fresh copy into its own folder and never deletes it afterwards (the vault stays
 * open in its window), so these accumulate. This drops folders older than
 * {@link ORPHANED_EXTRACTED_VAULT_MAX_AGE_IN_MILLISECONDS}. A folder whose vault is still open in another
 * window is locked on Windows and cannot be removed — the removal is wrapped so such a folder is simply
 * skipped and retried on a later open.
 */
function cleanupOrphanedExtractedVaults(): void {
  const extractedVaultsRoot = join(tmpdir(), DEMO_VAULTS_CACHE_FOLDER, EXTRACTED_VAULTS_SUBFOLDER);
  if (!existsSync(extractedVaultsRoot)) {
    return;
  }

  const now = Date.now();
  for (const entryName of readdirSync(extractedVaultsRoot)) {
    const entryPath = join(extractedVaultsRoot, entryName);
    try {
      const stats = statSync(entryPath);
      if (now - stats.mtimeMs < ORPHANED_EXTRACTED_VAULT_MAX_AGE_IN_MILLISECONDS) {
        continue;
      }
      rmSync(entryPath, { force: true, recursive: true });
    } catch {
      // Best-effort cleanup: an orphan whose vault is still open (locked on Windows) cannot be removed; skip it and retry on a later open.
    }
  }
}

/**
 * Extracts a downloaded demo-vault archive to disk.
 *
 * Electron's asar layer intercepts `fs` operations on any path containing `.asar` and throws `ENOENT`
 * when `chmod`-ing an `.asar` file (it treats it as an archive root rather than a plain file). A demo
 * vault may ship such a file (e.g. `_assets/CodeScriptToolkit/module.asar` demonstrating the ASAR
 * require feature), and adm-zip `chmod`s every extracted file, so extraction would otherwise crash.
 * Hand adm-zip Electron's `original-fs` — the real `fs` with asar interception disabled — so the
 * `.asar` file is treated as a plain file and `chmod` succeeds. It is a desktop-only Electron module
 * with no bundled types, so it is loaded via `window.require` and typed as `node:fs`'s shape.
 *
 * @param archive - The raw zip archive bytes.
 * @param targetDir - The directory to extract into.
 */
function extractDemoVaultArchive(archive: Buffer, targetDir: string): void {
  const originalFs = window.require('node:original-fs') as typeof import('node:fs');
  const zip = new AdmZip(archive, { fs: originalFs });
  zip.extractAllTo(targetDir, true);
}

/**
 * Extracts the archive into a fresh, uniquely-named temporary folder and returns the vault path.
 *
 * A unique parent folder (`mkdtempSync`) guarantees a brand-new extraction every time — the demo vault
 * is never reused across opens, so a previous session's edits never leak in. Inside it, the vault folder
 * is named `<plugin-id>-<version>.demo-vault` so Obsidian's vault switcher shows a friendly name (its
 * basename) rather than the random temp id.
 *
 * @param params - The {@link ExtractDemoVaultToFreshFolderParams}.
 * @returns The absolute path of the freshly extracted vault folder.
 */
function extractDemoVaultToFreshFolder(params: ExtractDemoVaultToFreshFolderParams): string {
  const { archive, pluginId, version } = params;
  const extractedVaultsRoot = join(tmpdir(), DEMO_VAULTS_CACHE_FOLDER, EXTRACTED_VAULTS_SUBFOLDER);
  mkdirSync(extractedVaultsRoot, { recursive: true });
  const uniqueParentDir = mkdtempSync(join(extractedVaultsRoot, `${pluginId}-${version}-`));
  const vaultDir = join(uniqueParentDir, `${pluginId}-${version}.demo-vault`);
  extractDemoVaultArchive(archive, vaultDir);
  return vaultDir;
}

/**
 * Resolves the demo-vault archive bytes for a version, downloading and caching them on first use.
 *
 * Only the archive is cached (keyed by plugin id + version); the extracted vault is not. A cache hit is
 * returned without any network request; a miss downloads the release asset, writes it to the archive
 * cache, and returns the freshly downloaded bytes.
 *
 * @param params - The {@link ResolveDemoVaultArchiveParams}.
 * @returns A {@link Promise} resolving to the archive bytes, or `null` when no archive is available for
 * the version (a notice has been shown).
 */
async function resolveDemoVaultArchive(params: ResolveDemoVaultArchiveParams): Promise<Buffer | null> {
  const {
    pluginId,
    pluginName,
    pluginNoticeComponent,
    progressNotice,
    repo,
    version
  } = params;

  const archivesDir = join(tmpdir(), DEMO_VAULTS_CACHE_FOLDER, ARCHIVES_SUBFOLDER);
  const archivePath = join(archivesDir, `${pluginId}-${version}.zip`);
  if (existsSync(archivePath)) {
    return readFileSync(archivePath);
  }

  progressNotice.setContent(`Downloading demo vault for ${pluginName} v${version}…`);
  const assetUrl = `https://github.com/${repo}/releases/download/${version}/${pluginId}-demo-vault-${version}.zip`;
  const response = await requestUrl({
    throw: false,
    url: assetUrl
  });
  if (response.status !== HTTP_STATUS_OK) {
    pluginNoticeComponent.showNotice(`No demo vault is available for plugin ${pluginName} v${version}.`);
    return null;
  }

  const archive = Buffer.from(response.arrayBuffer);
  mkdirSync(archivesDir, { recursive: true });
  writeFileSync(archivePath, archive);
  return archive;
}
