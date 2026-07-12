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
import { join } from '../path.ts';
import { resolvePathFromRootSafe } from './root.ts';

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

  // Archive name is hand-synced with the runtime `openDemoVault` opener, which downloads this exact asset name.
  const zipPath = resolvePathFromRootSafe({
    path: join(ObsidianPluginRepoPaths.DistBuild, `demo-vault-${newVersion}.zip`)
  });
  const zip = new AdmZip();
  zip.addLocalFolder(demoVaultPath);
  await zip.writeZipPromise(zipPath);
  return zipPath;
}
