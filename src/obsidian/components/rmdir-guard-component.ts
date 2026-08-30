/**
 * @file
 *
 * Contains class {@link RmdirGuardComponent} that makes the `recursive` flag of
 * {@link https://docs.obsidian.md/Reference/TypeScript+API/DataAdapter/rmdir | DataAdapter.rmdir} mean what it says.
 */

import type { App } from 'obsidian';

import { isEmptyFolder } from '../vault.ts';
import { MonkeyAroundComponent } from './monkey-around-component.ts';

/**
 * The `code` carried by the error thrown when a non-recursive `rmdir` is refused because the folder has children.
 *
 * Matches the POSIX/Node error code a correct non-recursive directory removal produces, so a caller already
 * branching on `error.code` keeps working. Check the `code`, never `instanceof` — every plugin bundles its own
 * copy of this library, so the error may cross a copy boundary.
 */
export const NOT_EMPTY_DIRECTORY_ERROR_CODE = 'ENOTEMPTY';

/**
 * Makes `app.vault.adapter.rmdir(path, false)` behave as its name promises: a non-recursive call on a folder
 * that still has children throws instead of deleting them.
 *
 * @remarks
 * Obsidian's adapters do not honor `recursive: false`, and they get it wrong in opposite directions:
 *
 * - `CapacitorAdapter` (mobile) does not accept the argument at all — it always removes recursively, so a
 *   non-recursive call silently deletes the folder and everything under it. This is the data-loss footgun.
 * - `FileSystemAdapter` (desktop) forwards it to `fs.promises.rm(path, { recursive })`, which throws
 *   `ERR_FS_EISDIR` for *any* directory when `recursive` is `false` — so the non-recursive call never
 *   succeeds, not even on an empty folder.
 *
 * While loaded, this component gives both platforms the same, correct behavior: a non-empty folder is
 * refused with an {@link NOT_EMPTY_DIRECTORY_ERROR_CODE} error and nothing is deleted; an empty folder is
 * removed. Emptiness is decided from the adapter (via {@link isEmptyFolder}), not from the vault index — the
 * index omits dot-prefixed and otherwise hidden entries, so a folder holding only hidden files reads as empty
 * there and the guard would wave through exactly the deletion it exists to prevent.
 *
 * A folder proven empty is removed by forwarding to the original method with `recursive: true`. That is not
 * merely defensive: it is what makes the empty-folder case succeed on desktop, where the non-recursive call
 * would otherwise throw.
 *
 * Calls that already pass `recursive: true`, and calls whose target is not a folder (a file, a missing path),
 * are passed through untouched and keep their native behavior.
 *
 * This component is deliberately **opt-in**: `app.vault.adapter` is shared by the whole app, so a library that
 * installed this patch on its own would change `rmdir` semantics for every other plugin, including the ones
 * that never asked for it. A plugin that deletes folders opts in for itself:
 *
 * @example
 * ```ts
 * this.addChild(new RmdirGuardComponent(this.app));
 * ```
 */
export class RmdirGuardComponent extends MonkeyAroundComponent {
  /**
   * Creates a new instance of the {@link RmdirGuardComponent} class.
   *
   * @param app - The Obsidian app instance whose vault adapter to guard.
   */
  public constructor(protected readonly app: App) {
    super();
  }

  /**
   * Installs the `rmdir` guard. The patch is uninstalled when this component unloads.
   */
  public override onload(): void {
    this.registerMethodPatch({
      $object: this.app.vault.adapter,
      methodName: 'rmdir',
      patchHandler: async ({
        fallback,
        originalArguments: [normalizedPath, recursive],
        originalMethodBound
      }) => {
        if (recursive) {
          await fallback();
          return;
        }

        const stats = await this.app.vault.adapter.stat(normalizedPath);
        if (stats?.type !== 'folder') {
          await fallback();
          return;
        }

        if (!await isEmptyFolder(this.app, normalizedPath)) {
          throw Object.assign(new Error(`Directory ${normalizedPath} is not empty`), {
            code: NOT_EMPTY_DIRECTORY_ERROR_CODE,
            path: normalizedPath
          });
        }

        // The folder is proven empty, so a recursive removal is equivalent -- and, unlike the non-recursive
        // One, it actually works on the desktop adapter.
        await originalMethodBound(normalizedPath, true);
      }
    });
  }
}
