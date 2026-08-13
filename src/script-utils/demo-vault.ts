/**
 * @file
 *
 * Archives a plugin's demo vault as a release artifact.
 *
 * A plugin can ship a curated demo vault at `demo-vault/` in its repo root. At release time this
 * module installs the freshly built plugin into that vault's `.obsidian/plugins/<id>/` folder and
 * zips the whole vault into `dist/build/<plugin-id>-demo-vault-<version>.zip`, so the existing
 * GitHub-release step (which uploads every file in `dist/build/`) attaches it automatically. The
 * archive name carries the plugin id (so several plugins' demo vaults never collide) and the version
 * (so each release ships its own distinctly named artifact).
 *
 * The archived copy also carries the `.obsidian/app.json` settings this package owns (see
 * `demo-vault-app-json.ts`). They are written into the ZIP ENTRY and never into the repo folder: the
 * committed `app.json` is a tracked file, and `updateVersion` archives after it has already pushed, so
 * an in-place write would leave an uncommitted change behind a published release.
 */

import AdmZip from 'adm-zip';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';

import type { DemoVaultHelperSettings } from '../obsidian/demo-vault-helper-settings.ts';
import type { DemoVaultAppJson } from './demo-vault-app-json.ts';

import { ObsidianPluginRepoPaths } from '../obsidian/plugin/obsidian-plugin-repo-paths.ts';
import {
  getFolderName,
  join
} from '../path.ts';
import {
  buildArchivedDemoVaultAppJsonContent,
  findOwnedDemoVaultAppJsonSettings,
  parseDemoVaultAppJson
} from './demo-vault-app-json.ts';
import { ObsidianDevUtilsRepoPaths } from './obsidian-dev-utils-repo-paths.ts';
import {
  getRootFolder,
  resolvePathFromRootSafe
} from './root.ts';

const DEMO_VAULT_HELPER_PLUGIN_ID = 'demo-vault-helper';
const DATA_JSON_FILE_NAME = 'data.json';
const DATA_JSON_INDENT = 2;

/**
 * The minimal shape of a plugin `manifest.json` read by {@link archivePluginDemoVault}.
 */
interface PluginManifest {
  /**
   * The plugin id, used as the folder name under `demo-vault/.obsidian/plugins/`.
   */
  readonly id: string;

  /**
   * The plugin version, embedded in the archive file name.
   */
  readonly version: string;
}

/**
 * Archives the plugin's demo vault (`demo-vault/` in the repo root) as a release artifact.
 *
 * Installs the freshly built plugin from `dist/build/` into the vault's
 * `.obsidian/plugins/<id>/` folder, then zips the whole vault to
 * `dist/build/<plugin-id>-demo-vault-<version>.zip`.
 *
 * @returns A {@link Promise} that resolves to the absolute path of the created zip archive, or
 * `null` if the repo has no `demo-vault/` folder.
 */
export async function archivePluginDemoVault(): Promise<null | string> {
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

  await injectDemoVaultHelper(manifest.id);

  // Archive name is hand-synced with the runtime `openDemoVault` opener, which downloads this exact asset name.
  const zipPath = resolvePathFromRootSafe({
    path: join(ObsidianPluginRepoPaths.DistBuild, `${manifest.id}-demo-vault-${manifest.version}.zip`)
  });
  const zip = new AdmZip();
  zip.addLocalFolder(demoVaultPath);
  injectAppJson(zip, await readCommittedAppJson());
  await zip.writeZipPromise(zipPath);
  return zipPath;
}

// Stores the archived vault's `.obsidian/app.json` — the committed settings with the owned ones merged
// Over them. The entry is replaced rather than the file, so the repo folder is left exactly as it was.
function injectAppJson(zip: AdmZip, appJson: DemoVaultAppJson): void {
  const entryName = join(ObsidianPluginRepoPaths.DotObsidian, ObsidianPluginRepoPaths.AppJson);
  const content = Buffer.from(buildArchivedDemoVaultAppJsonContent({ appJson }), 'utf-8');
  const entry = zip.getEntry(entryName);
  if (entry) {
    zip.updateFile(entry, content);
    return;
  }

  // A vault with nothing else to configure commits no `app.json` at all, which is the expected state.
  zip.addFile(entryName, content);
}

// Injects the built, `obsidian-dev-utils`-owned `demo-vault-helper` bootstrap plugin (shipped in this package) into the demo vault, so no per-vault copy is committed and an `obsidian-dev-utils` bump propagates fixes.
//
// Alongside the binaries it writes the helper's own `data.json` naming the demonstrated plugin. That is
// The one moment the id is known for certain — it comes from the plugin's own manifest — whereas the
// Opened vault only offers plugin folders to count, which the bootstrap itself adds to (see
// `DemoVaultHelperSettings`).
async function injectDemoVaultHelper(demoedPluginId: string): Promise<void> {
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

  const settings: DemoVaultHelperSettings = { demoedPluginId };
  await writeFile(join(helperFolder, DATA_JSON_FILE_NAME), `${JSON.stringify(settings, null, DATA_JSON_INDENT)}\n`, 'utf-8');
}

// Reads the demo vault's committed `.obsidian/app.json`, refusing the settings this package owns.
//
// Those settings are injected into the archive, so a committed one is a second source of truth that
// Nothing keeps in step. The demo-vault coverage suite already fails on it, which means reaching here
// Means that gate was skipped — so this refuses rather than overwriting a value somebody chose on purpose.
async function readCommittedAppJson(): Promise<DemoVaultAppJson> {
  const appJsonPath = resolvePathFromRootSafe({
    path: join(ObsidianPluginRepoPaths.DemoVault, ObsidianPluginRepoPaths.DotObsidian, ObsidianPluginRepoPaths.AppJson)
  });
  const content = existsSync(appJsonPath) ? await readFile(appJsonPath, 'utf-8') : null;
  const appJson = parseDemoVaultAppJson({ content, path: appJsonPath });

  const ownedSettings = findOwnedDemoVaultAppJsonSettings({ appJson });
  if (ownedSettings.length > 0) {
    throw new Error(
      `${appJsonPath} sets ${ownedSettings.join(', ')}, which obsidian-dev-utils owns and writes into the archived demo vault. Settings it owns must not be committed.`
    );
  }

  return appJson;
}
