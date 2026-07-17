/**
 * @file
 *
 * Archives a plugin's demo vault as a release artifact.
 *
 * A plugin can ship a curated demo vault at `demo-vault/` in its repo root. At release time this
 * module installs the freshly built plugin into that vault's `.obsidian/plugins/<id>/` folder and
 * zips the whole vault into `dist/build/demo-vault-<version>.zip`, so the existing GitHub-release
 * step (which uploads every file in `dist/build/`) attaches it automatically.
 */

import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  readFile
} from 'node:fs/promises';

import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  getFolderName,
  join
} from '../path.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import {
  getRootFolder,
  resolvePathFromRootSafe
} from './root.ts';

const DEMO_VAULT_HELPER_PLUGIN_ID = 'demo-vault-helper';

/**
 * The minimal shape of a plugin `manifest.json` read by {@link archivePluginDemoVault}.
 */
interface PluginManifest {
  /**
   * The plugin id, used as the folder name under `demo-vault/.obsidian/plugins/`.
   */
  readonly id: string;
}

/**
 * Archives the plugin's demo vault (`demo-vault/` in the repo root) as a release artifact.
 *
 * Installs the freshly built plugin from `dist/build/` into the vault's
 * `.obsidian/plugins/<id>/` folder, then zips the whole vault to
 * `dist/build/demo-vault-<version>.zip`.
 *
 * @param newVersion - The version being released, used in the archive file name.
 * @returns A {@link Promise} that resolves to the absolute path of the created zip archive, or
 * `null` if the repo has no `demo-vault/` folder.
 */
export async function archivePluginDemoVault(newVersion: string): Promise<null | string> {
  const demoVaultPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.DemoVault });
  if (!existsSync(demoVaultPath)) {
    return null;
  }

  const manifestPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.ManifestJson });
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as PluginManifest;

  const pluginFolder = resolvePathFromRootSafe({
    path: join(
      ObsidianPluginRepoPaths.DemoVault,
      ObsidianPluginRepoPaths.DotObsidian,
      ObsidianPluginRepoPaths.Plugins,
      manifest.id
    )
  });
  await mkdir(pluginFolder, { recursive: true });

  const distBuildPath = resolvePathFromRootSafe({ path: ObsidianPluginRepoPaths.DistBuild });
  await cp(distBuildPath, pluginFolder, { recursive: true });

  await injectDemoVaultHelper();

  // Archive name is hand-synced with the runtime `openDemoVault` opener, which downloads this exact asset name.
  const zipPath = resolvePathFromRootSafe({
    path: join(ObsidianPluginRepoPaths.DistBuild, `demo-vault-${newVersion}.zip`)
  });
  const zip = new AdmZip();
  zip.addLocalFolder(demoVaultPath);
  await zip.writeZipPromise(zipPath);
  return zipPath;
}

// Injects the built, `obsidian-dev-utils`-owned `demo-vault-helper` bootstrap plugin (shipped in this package) into the demo vault, so no per-vault copy is committed and an `obsidian-dev-utils` bump propagates fixes.
async function injectDemoVaultHelper(): Promise<void> {
  const packageFolder = getRootFolder(getFolderName(import.meta.url));
  if (!packageFolder) {
    throw new Error('Could not resolve the obsidian-dev-utils package folder to inject the demo-vault-helper plugin.');
  }

  const helperSourcePath = join(packageFolder, ObsidianDevUtilsRepoPaths.DistDemoVaultHelper);
  const helperFolder = resolvePathFromRootSafe({
    path: join(
      ObsidianPluginRepoPaths.DemoVault,
      ObsidianPluginRepoPaths.DotObsidian,
      ObsidianPluginRepoPaths.Plugins,
      DEMO_VAULT_HELPER_PLUGIN_ID
    )
  });
  await mkdir(helperFolder, { recursive: true });
  await cp(helperSourcePath, helperFolder, { recursive: true });
}
