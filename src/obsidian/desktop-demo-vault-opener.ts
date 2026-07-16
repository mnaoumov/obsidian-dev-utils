/**
 * @file
 *
 * Downloads and opens a plugin's shipped demo vault in a new Obsidian window (desktop only).
 *
 * A plugin can attach a `demo-vault-<version>.zip` archive to each GitHub release (see
 * `archivePluginDemoVault` in `script-utils/demo-vault.ts`). This resolves the plugin's repository
 * from Obsidian's community registry, downloads the archive for the chosen version, extracts it to a
 * per-version cache folder under the OS temp directory, and opens that folder as a vault in a new
 * window. When the installed plugin version is behind the latest release, the user is offered a choice
 * between the two versions.
 */

import type {
  App,
  PluginManifest
} from 'obsidian';

import AdmZip from 'adm-zip';
import { compareVersions } from 'compare-versions';
// eslint-disable-next-line import-x/no-nodejs-modules -- Desktop-only feature gated by `Platform.isDesktopApp`; the command is hidden on mobile so this Node API is never reached there.
import { Buffer } from 'node:buffer';
// eslint-disable-next-line import-x/no-nodejs-modules -- Desktop-only feature gated by `Platform.isDesktopApp`; the command is hidden on mobile so this Node API is never reached there.
import { existsSync } from 'node:fs';
// eslint-disable-next-line import-x/no-nodejs-modules -- Desktop-only feature gated by `Platform.isDesktopApp`; the command is hidden on mobile so this Node API is never reached there.
import { tmpdir } from 'node:os';
import { requestUrl } from 'obsidian';

import type { PluginNoticeComponent } from './components/plugin-notice-component.ts';

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
   * The manifest of the plugin whose demo vault is opened. Its `id` locates the GitHub repository, its
   * `version` selects the archive, and its `name` labels the notices and the version-choice dialog.
   */
  readonly manifest: PluginManifest;

  /**
   * The notice component used to report problems (plugin not in the registry, missing archive).
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

interface DownloadAndExtractDemoVaultParams {
  readonly cacheDir: string;
  readonly manifest: PluginManifest;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly repo: string;
  readonly version: string;
}

const DEMO_VAULTS_CACHE_FOLDER = 'obsidian-demo-vaults';
const HTTP_STATUS_OK = 200;

/**
 * Downloads and opens the plugin's demo vault in a new Obsidian window. Desktop only.
 *
 * If the installed plugin version is the latest (or newer), its demo vault opens directly; otherwise
 * the user chooses between the latest and the currently-installed version. The chosen version's
 * archive is downloaded and extracted once, then reused from a per-version cache folder.
 *
 * @param params - The {@link OpenDemoVaultParams}.
 * @returns A {@link Promise} that resolves once the vault has been opened, or once the operation has
 * been reported as not possible (notice shown) or cancelled by the user.
 */
export async function openDemoVault(params: OpenDemoVaultParams): Promise<void> {
  const {
    app,
    manifest,
    pluginNoticeComponent
  } = params;

  const repo = await getCommunityPluginRepo(manifest.id);
  if (!repo) {
    pluginNoticeComponent.showNotice(`Could not find plugin ${manifest.name} in the community plugins registry.`);
    return;
  }

  const currentVersion = manifest.version;
  const latestVersion = await getLatestReleaseVersion(repo);

  let versionToOpen: string;
  if (compareVersions(currentVersion, latestVersion) >= 0) {
    versionToOpen = currentVersion;
  } else {
    const chosenVersion = await selectOption<null | string>({
      app,
      message: `Current version of plugin ${manifest.name} v${currentVersion} is not the latest (v${latestVersion})`,
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
      title: manifest.name
    });
    if (chosenVersion === null) {
      return;
    }
    versionToOpen = chosenVersion;
  }

  const cacheDir = join(tmpdir(), DEMO_VAULTS_CACHE_FOLDER, manifest.id, versionToOpen);
  if (!existsSync(cacheDir)) {
    const isExtracted = await downloadAndExtractDemoVault({
      cacheDir,
      manifest,
      pluginNoticeComponent,
      repo,
      version: versionToOpen
    });
    if (!isExtracted) {
      return;
    }
  }

  window.electron.ipcRenderer.sendSync('vault-open', cacheDir, false);
}

async function downloadAndExtractDemoVault(params: DownloadAndExtractDemoVaultParams): Promise<boolean> {
  const {
    cacheDir,
    manifest,
    pluginNoticeComponent,
    repo,
    version
  } = params;

  const assetUrl = `https://github.com/${repo}/releases/download/${version}/demo-vault-${version}.zip`;
  const response = await requestUrl({
    throw: false,
    url: assetUrl
  });
  if (response.status !== HTTP_STATUS_OK) {
    pluginNoticeComponent.showNotice(`No demo vault is available for plugin ${manifest.name} v${version}.`);
    return false;
  }

  const zip = new AdmZip(Buffer.from(response.arrayBuffer));
  zip.extractAllTo(cacheDir, true);
  return true;
}
