/**
 * @file
 *
 * The `demo-vault-helper` bootstrap plugin.
 *
 * A tiny, plugin-agnostic plugin injected into every demo vault at release time. On layout-ready it
 * bootstraps CodeScript Toolkit so the demo notes' `code-button`s work with no manual setup. The real
 * logic lives in `obsidian-dev-utils` (`bootstrapDemoVault`); this wrapper is only the Obsidian plugin
 * shell, bundled standalone so the injected copy needs no runtime dependency on the library.
 */

import {
  Notice,
  Plugin
} from 'obsidian';

import { bootstrapDemoVault } from '@mnaoumov/obsidian-lib/demo-vault-helper';

/**
 * The `demo-vault-helper` bootstrap plugin.
 */
export default class DemoVaultHelperPlugin extends Plugin {
  public override onload(): void {
    this.app.workspace.onLayoutReady(() => {
      void this.bootstrap();
    });
  }

  private async bootstrap(): Promise<void> {
    try {
      await bootstrapDemoVault({ app: this.app });
    } catch (error) {
      new Notice(`Demo Vault Helper failed to bootstrap: ${String(error)}`);
      console.error(error);
    }
  }
}
