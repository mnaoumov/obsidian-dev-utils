/**
 * @file
 *
 * The `demo-vault-helper` plugin's own settings — the contract between the demo-vault packaging step
 * and the bootstrap that runs inside the opened vault.
 *
 * The helper has to name the plugin the vault demonstrates, and nothing inside the vault reliably says
 * which one that is: the plugin folders also hold the helper itself, CodeScript Toolkit once the
 * bootstrap has installed it, and anything a demo note's prerequisites installed, so counting them
 * guesses (and guesses differently on a re-open). The packaging step, on the other hand, KNOWS — it
 * reads the plugin's `manifest.json` to name the archive — so it writes the id down here and the
 * bootstrap simply reads it.
 *
 * The marker and the helper binary are written together, by the same `obsidian-dev-utils` version, into
 * the same archive, so the two can never disagree.
 *
 * Kept free of `obsidian` imports on purpose: the packaging step ({@link archivePluginDemoVault}) runs
 * under Node, where the `obsidian` module does not exist.
 */

/**
 * The `demo-vault-helper` plugin's `data.json`, written into the demo vault at packaging time.
 */
export interface DemoVaultHelperSettings {
  /**
   * The id of the plugin the vault demonstrates, taken from that plugin's `manifest.json`.
   */
  readonly demoedPluginId: string;
}
