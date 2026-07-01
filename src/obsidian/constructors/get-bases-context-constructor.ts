/**
 * @file
 *
 * Extracts the `BasesContext` constructor from a live bases view so a throwaway context can be
 * constructed to patch the bases note rendering.
 *
 * The `BasesContext` class is not exposed as a runtime value, so its constructor can only be read
 * from a live `controller.ctx` instance, which exists only once a base with a loaded query is open.
 * This resolves such an instance with as little disruption as possible: it reuses an already-open
 * bases view when present, otherwise opens an existing base file, and only as a last resort creates
 * (and removes) a temporary base file. The Bases internal plugin is enabled temporarily when needed
 * and restored to its previous state afterwards.
 */

import type {
  BasesContext,
  BasesView,
  ExtractConstructor
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  TFile,
  WorkspaceLeaf
} from 'obsidian';

import {
  InternalPluginName,
  ViewType
} from '@obsidian-typings/obsidian-public-latest/implementations';
import { retryWithTimeout } from 'obsidian-dev-utils/async';
import { trashSafe } from 'obsidian-dev-utils/obsidian/vault';
import { assertNonNullable } from 'obsidian-dev-utils/type-guards';

import { BASE_FILE_EXTENSION } from '../file-system.ts';

/**
 * The constructor of a {@link BasesContext}.
 */
export type BasesContextConstructor = ExtractConstructor<BasesContext>;

class BasesContextConstructorExtractor {
  public constructor(private readonly app: App) {}

  public async extract(): Promise<BasesContextConstructor> {
    const basesPlugin = this.app.internalPlugins.getPluginById(InternalPluginName.Bases);
    assertNonNullable(basesPlugin, 'Bases plugin is not available');

    const wasBasesEnabled = basesPlugin.enabled;
    if (!wasBasesEnabled) {
      await basesPlugin.enable();
    }

    try {
      return await this.extractFromAnyBase();
    } finally {
      if (!wasBasesEnabled) {
        basesPlugin.disable();
      }
    }
  }

  private async createTempBaseFile(): Promise<TFile> {
    const basesPlugin = this.app.internalPlugins.getEnabledPluginById(InternalPluginName.Bases);
    assertNonNullable(basesPlugin, 'Bases plugin is not enabled');
    return await basesPlugin.createNewBasesFile();
  }

  private async extractFromAnyBase(): Promise<BasesContextConstructor> {
    const openBasesLeaf = this.app.workspace.getLeavesOfType(ViewType.Bases)[0];
    if (openBasesLeaf) {
      return await this.extractFromLeaf(openBasesLeaf);
    }

    const existingBaseFile = this.app.vault.getFiles().find((file) => file.extension === BASE_FILE_EXTENSION);
    if (existingBaseFile) {
      return await this.openAndExtract(existingBaseFile, false);
    }

    const tempBaseFile = await this.createTempBaseFile();
    return await this.openAndExtract(tempBaseFile, true);
  }

  private async extractFromLeaf(leaf: WorkspaceLeaf): Promise<BasesContextConstructor> {
    await leaf.loadIfDeferred();

    // The bases view controller does not create its context synchronously, so wait until it has built
    // Its context before reading the constructor.
    await retryWithTimeout({
      operationFn: () => ((leaf.view as BasesView).controller.ctx as BasesContext | null) !== null,
      operationName: 'getBasesContextConstructor'
    });

    return (leaf.view as BasesView).controller.ctx.constructor as BasesContextConstructor;
  }

  private async openAndExtract(file: TFile, shouldTrashFile: boolean): Promise<BasesContextConstructor> {
    const leaf = this.app.workspace.getLeaf(true);
    try {
      await leaf.openFile(file);
      return await this.extractFromLeaf(leaf);
    } finally {
      leaf.detach();
      if (shouldTrashFile) {
        await trashSafe(this.app, file);
      }
    }
  }
}

/**
 * Gets the {@link BasesContext} constructor.
 *
 * @param app - The Obsidian app instance.
 * @returns A {@link Promise} that resolves to the {@link BasesContextConstructor}.
 */
export async function getBasesContextConstructor(app: App): Promise<BasesContextConstructor> {
  return await new BasesContextConstructorExtractor(app).extract();
}
