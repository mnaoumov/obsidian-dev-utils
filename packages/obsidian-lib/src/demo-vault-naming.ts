/**
 * @file
 *
 * The names a plugin's demo-vault release artifact carries — the one contract between the release-time
 * packaging step and the runtime opener.
 *
 * The two live far apart: `script-utils/demo-vault.ts` runs under Node at release time and WRITES the
 * archive, while `desktop-demo-vault-opener.ts` runs inside Obsidian and DOWNLOADS it by name. They used
 * to agree by a comment on each side saying the other must be changed too, which is exactly the sort of
 * pairing that survives until the day it does not. Both now derive every shared name from here.
 *
 * Kept free of `obsidian` and `node:` imports on purpose: the packaging step runs under Node, where the
 * `obsidian` module does not exist, and the opener sits in the generated barrels, which must stay safe to
 * evaluate on mobile.
 */

/**
 * Parameters for {@link getDemoVaultFolderName}.
 */
export interface GetDemoVaultFolderNameParams {
  /**
   * The plugin id the vault demonstrates, from that plugin's `manifest.json`.
   */
  readonly pluginId: string;

  /**
   * The plugin version the vault ships with.
   */
  readonly version: string;
}

/**
 * The file name of the demo-vault archive attached to a plugin's GitHub release.
 *
 * Carries the plugin id so several plugins' demo vaults never collide, and deliberately NOT the version:
 * a release asset is already namespaced by its release tag (`…/releases/download/<version>/…`), so the
 * version bought no disambiguation while making the asset name change on every release — which is what
 * broke the Community directory's finding overrides, whose fingerprint includes the name. The version
 * lives inside the archive instead, as {@link getDemoVaultFolderName} and on the README's heading.
 *
 * @param pluginId - The plugin id the vault demonstrates.
 * @returns The archive file name, e.g. `my-plugin-demo-vault.zip`.
 */
export function getDemoVaultArchiveFileName(pluginId: string): string {
  return `${getDemoVaultBaseName(pluginId)}.zip`;
}

/**
 * The name of the demo vault's own folder — the archive's single top-level entry, and the folder the
 * opener extracts it to.
 *
 * One name serves both because they are the same folder seen twice: a user who unzips the archive by hand
 * gets a self-describing, version-distinct folder rather than an anonymous one, and a user who runs the
 * `Open demo vault` command sees that same name in Obsidian's vault switcher.
 *
 * @param params - The {@link GetDemoVaultFolderNameParams}.
 * @returns The folder name, e.g. `my-plugin-demo-vault-1.2.3`.
 */
export function getDemoVaultFolderName(params: GetDemoVaultFolderNameParams): string {
  const {
    pluginId,
    version
  } = params;
  return `${getDemoVaultBaseName(pluginId)}-${version}`;
}

function getDemoVaultBaseName(pluginId: string): string {
  return `${pluginId}-demo-vault`;
}
