/**
 * @file
 *
 * Path-scoped resource locking for vault files and folders, with three enforcement layers over one
 * shared locked-path set:
 *
 * 1. **Editor read-only** — while a path is locked, every current and future {@link MarkdownView} of
 *    that note (in any window, including popouts) is made read-only and shows a lock indicator in its
 *    tab header, its view action bar, and the status bar; a note inside a `subtree`-locked folder is
 *    covered too. Locks are reference-counted per locking plugin (the indicators' tooltip lists which
 *    plugins hold a lock), so nested/concurrent operations are safe — the path is unlocked only when
 *    the last lock is released.
 * 2. **Vault-mutation blocking** (opt-in via `shouldBlockMutations`) — any edit/delete/rename/move/
 *    create of a locked path through the `Vault`/`FileManager` API throws {@link ResourceLockedError},
 *    unless the owning operation has opened a {@link ResourceLockComponent.bypassBlockedMutations} scope
 *    over that path.
 * 3. **External-change detection** — a vault/metadata event on a locked path that no bypass scope
 *    covers is treated as an intruder (Sync / raw filesystem / another plugin) and aborts the owning
 *    operation's {@link AbortController}.
 *
 * The acquirers return a {@link Disposable}, so the preferred call style is a `using` declaration that
 * releases automatically at scope exit (including on throw):
 *
 * ```ts
 * using _lock = lockResourceForPath({ app, pathOrFile: path, pluginId: this.manifest.id, operationName: 'Process note' });
 * // ... long-running work (process, processFrontMatter, merge/split) ...
 * // auto-unlocked at scope exit
 * ```
 *
 * The explicit {@link unlockResourceForPath} pair remains available for non-`using` call sites.
 */

import type {
  App,
  TAbstractFile
} from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  FileManager,
  MarkdownView,
  Menu,
  setIcon,
  setTooltip,
  Vault
} from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import { convertAsyncToSync } from '../async.ts';
import { Beeper } from '../beeper.ts';
import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from '../disposable.ts';
import { noop } from '../function.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { assertNonNullable } from '../type-guards.ts';
import { ComponentEx } from './components/component-ex.ts';
import { MonkeyAroundComponent } from './components/monkey-around-component.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { getPath } from './file-system.ts';
import { appendCodeBlock } from './html-element.ts';
import { t } from './i18n/i18n.ts';
import { confirm } from './modals/confirm.ts';
import {
  isChild,
  isChildOrSelf
} from './vault.ts';

const RESOURCE_LOCK_STATE_KEY = 'resourceLock';
const LOCK_ICON_ID = 'lock';
const LOCK_INDICATOR_CSS_CLASS = 'obsidian-dev-utils-lock-indicator';
const LOCK_INDICATOR_FLASH_CSS_CLASS = 'obsidian-dev-utils-lock-indicator-flash';
const STATUS_BAR_ITEM_CSS_CLASS = 'status-bar-item';
const STATUS_BAR_CSS_SELECTOR = '.status-bar';
const UNLOCK_ICON_ID = 'unlock';
const MIDDLE_MOUSE_BUTTON = 1;

/**
 * Parameters for {@link lockResourceForPath}.
 */
export interface LockResourceForPathParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * A human-readable name of the operation taking the lock (e.g. `'Move selection'`). Shown next to
   * the plugin name in the unlock confirmation dialog.
   */
  readonly operationName: string;

  /**
   * The path or file of the note to lock.
   */
  readonly pathOrFile: PathOrFile;

  /**
   * The id of the locking plugin (e.g. its `manifest.id`). The lock is attributed to it for
   * reference-counting and the indicators' "locked by" tooltip.
   */
  readonly pluginId: string;
}

/**
 * Parameters for {@link ResourceLockComponent.lockForPath}.
 */
export interface ResourceLockComponentLockForPathParams {
  /**
   * An optional {@link AbortController} associated with the lock. When a lock indicator is clicked (with
   * any mouse button) and the user confirms an unlock, the "Unlock active note" command runs, or
   * {@link ResourceLockComponent.requestUnlockForPath} / {@link requestResourceUnlockForPath} is called
   * for the path, this controller is aborted so the operation holding the lock can cancel itself. Unless
   * {@link ResourceLockComponentLockForPathParams.shouldReleaseOnAbort} is set, the operation is
   * expected to release the lock in its own cleanup. When omitted, an unlock still releases the lock but
   * cannot cancel the operation that took it.
   */
  readonly abortController?: AbortController;

  /**
   * The lock scope. `'subtree'` also locks every descendant of a folder path; `'file'` locks only the
   * exact path. A `subtree` lock must be released via the returned {@link Disposable} (not the
   * explicit {@link ResourceLockComponent.unlockForPath}).
   *
   * @default `'file'`
   */
  readonly mode?: ResourceLockMode;

  /**
   * When provided, this callback is invoked when an unlock of the lock is requested — i.e. when the
   * lock's {@link ResourceLockComponentLockForPathParams.abortController} is aborted (by the
   * indicator's "Unlock" menu, the "Unlock active note" command, {@link ResourceLockComponent.requestUnlockForPath},
   * or {@link handleExternalMutation}). Use it to clear consumer-side state that shadows the lock (e.g.
   * a pending-operation buffer or a notice) without hand-wiring an `abort` listener. Fires at most once.
   */
  onUnlockRequested?(this: void): void;

  /**
   * A human-readable name of the operation that took the lock (e.g. `'Move selection'`, `'Merge
   * notes'`). It is shown — next to the locking plugin's name — in the unlock confirmation dialog, so
   * the user sees exactly which operation an unlock would cancel.
   */
  readonly operationName: string;

  /**
   * The path or file of the note to lock.
   */
  readonly pathOrFile: PathOrFile;

  /**
   * When `true`, the lock also **blocks vault mutations** of the covered path(s): any attempt to edit,
   * delete, rename, move, or (re)create the resource through the `Vault`/`FileManager` API throws a
   * {@link ResourceLockedError}. Installed lazily on the first such lock and removed when the last one
   * is released. When `false` (the default) the lock only makes the editor read-only — legacy behavior,
   * so existing consumers that write to a note they hold an editor lock on are unaffected.
   *
   * @default `false`
   */
  readonly shouldBlockMutations?: boolean;

  /**
   * When `true`, the lock releases itself the moment its
   * {@link ResourceLockComponentLockForPathParams.abortController} is aborted, instead of relying on
   * the owning operation to release it in its own cleanup. Use it for a lock held **indefinitely**
   * outside a `using` scope (so there is no `finally` to release it) — e.g. a lock that stays until the
   * user explicitly unlocks. Leave it `false` for a transactional operation that holds the lock through
   * its own abort-driven rollback and releases it via `using` at scope exit. Has no effect without an
   * {@link ResourceLockComponentLockForPathParams.abortController}.
   *
   * @default `false`
   */
  readonly shouldReleaseOnAbort?: boolean;
}

/**
 * The scope of a lock.
 *
 * - `'file'` locks only the exact path.
 * - `'subtree'` locks the path and every descendant under it (its whole folder subtree), so a file
 *   inside a `subtree`-locked folder is treated as locked too.
 */
export type ResourceLockMode = 'file' | 'subtree';

interface LockDescriptor {
  readonly operationName: string;
  readonly pluginName: string;
}

interface LockEntry {
  readonly abortController: AbortController | null;
  readonly blocksMutations: boolean;
  readonly mode: ResourceLockMode;
  readonly onUnlockRequested: (() => void) | null;
  readonly operationName: string;
  readonly pluginId: string;
  readonly shouldReleaseOnAbort: boolean;
}

interface LockIndicators {
  readonly actionIconEl: HTMLElement;
  disposeTypeListener(): void;
  readonly tabIconEl: HTMLElement | null;
}

interface ManagerLockParams {
  readonly abortController?: AbortController | undefined;
  readonly app: App;
  readonly blocksMutations?: boolean | undefined;
  readonly mode?: ResourceLockMode | undefined;
  readonly onUnlockRequested?: (() => void) | undefined;
  readonly operationName: string;
  readonly pathOrFile: PathOrFile;
  readonly pluginId: string;
  readonly shouldReleaseOnAbort?: boolean | undefined;
}

/**
 * Constructor parameters for {@link ResourceLockEventsComponent}.
 */
interface ResourceLockEventsComponentConstructorParams {
  readonly app: App;
  onChange(this: void): void;
  onExternalMutation(this: void, path: string): void;
  onFileMenu(this: void, menu: Menu, file: TAbstractFile): void;
}

interface ResourceLockMutationBlockerComponentConstructorParams {
  shouldBlockMutation(this: void, path: string): boolean;
}

/**
 * Subscribes to the workspace events that should trigger a lock reconcile (and the file context-menu
 * event that offers an "Unlock" item). Implemented as a {@link ComponentEx} so the subscriptions are
 * registered on `load()` and automatically removed on `unload()`, instead of being tracked by hand.
 */
class ResourceLockEventsComponent extends ComponentEx {
  private readonly app: App;
  private readonly onChange: () => void;
  private readonly onExternalMutation: (path: string) => void;
  private readonly onFileMenu: (menu: Menu, file: TAbstractFile) => void;

  public constructor(params: ResourceLockEventsComponentConstructorParams) {
    super();
    this.app = params.app;
    this.onChange = params.onChange;
    this.onExternalMutation = params.onExternalMutation;
    this.onFileMenu = params.onFileMenu;
  }

  public override onload(): void {
    super.onload();
    this.registerEvent(this.app.workspace.on('active-leaf-change', this.onChange));
    this.registerEvent(this.app.workspace.on('layout-change', this.onChange));
    // Same-leaf navigation to another note fires no leaf/layout change; without this it stays read-only.
    this.registerEvent(this.app.workspace.on('file-open', this.onChange));
    // Adds an "Unlock" item to a locked note's tab/file context menu (alongside the indicator menus).
    this.registerEvent(this.app.workspace.on('file-menu', this.onFileMenu));
    // External-change backstop: a vault/metadata event on a mutation-blocked path not covered by an active bypass scope is an intruder (a sync/FS/adapter change that bypassed the blocker patch).
    this.registerEvent(this.app.vault.on('create', (file): void => {
      this.onExternalMutation(file.path);
    }));
    this.registerEvent(this.app.vault.on('delete', (file): void => {
      this.onExternalMutation(file.path);
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath): void => {
      this.onExternalMutation(oldPath);
      this.onExternalMutation(file.path);
    }));
    this.registerEvent(this.app.metadataCache.on('deleted', (file): void => {
      this.onExternalMutation(file.path);
    }));
  }
}

/**
 * Monkey-patches the vault-mutation choke points on `Vault`/`FileManager` so that any edit, delete,
 * rename, move, or (re)create of a mutation-blocked path throws a {@link ResourceLockedError}.
 * Installed lazily by {@link ResourceLockManager} on the first `shouldBlockMutations` lock and removed
 * when the last one is released; being a {@link MonkeyAroundComponent}, every patch is torn down on
 * `unload`. Rename/copy check both source and destination; the other methods check their single path.
 */
class ResourceLockMutationBlockerComponent extends MonkeyAroundComponent {
  private readonly shouldBlockMutation: (path: string) => boolean;

  public constructor(params: ResourceLockMutationBlockerComponentConstructorParams) {
    super();
    this.shouldBlockMutation = params.shouldBlockMutation;
  }

  public override onload(): void {
    super.onload();

    this.registerMethodPatch<Vault, 'append'>({
      methodName: 'append',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'copy'>({
      methodName: 'copy',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [, newPath] }) => {
        this.assertNotBlocked([newPath]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'create'>({
      methodName: 'create',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [path] }) => {
        this.assertNotBlocked([path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'createBinary'>({
      methodName: 'createBinary',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [path] }) => {
        this.assertNotBlocked([path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'createFolder'>({
      methodName: 'createFolder',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [path] }) => {
        this.assertNotBlocked([path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'delete'>({
      methodName: 'delete',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'modify'>({
      methodName: 'modify',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'modifyBinary'>({
      methodName: 'modifyBinary',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'process'>({
      methodName: 'process',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'rename'>({
      methodName: 'rename',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file, newPath] }) => {
        this.assertNotBlocked([file.path, newPath]);
        return fallback();
      }
    });
    this.registerMethodPatch<Vault, 'trash'>({
      methodName: 'trash',
      obj: Vault.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
    this.registerMethodPatch<FileManager, 'renameFile'>({
      methodName: 'renameFile',
      obj: FileManager.prototype,
      patchHandler: ({ fallback, originalArgs: [file, newPath] }) => {
        this.assertNotBlocked([file.path, newPath]);
        return fallback();
      }
    });
    this.registerMethodPatch<FileManager, 'trashFile'>({
      methodName: 'trashFile',
      obj: FileManager.prototype,
      patchHandler: ({ fallback, originalArgs: [file] }) => {
        this.assertNotBlocked([file.path]);
        return fallback();
      }
    });
  }

  private assertNotBlocked(paths: string[]): void {
    for (const path of paths) {
      if (this.shouldBlockMutation(path)) {
        throw new ResourceLockedError(path);
      }
    }
  }
}

/**
 * Tracks path-scoped editor locks and keeps every open {@link MarkdownView} in sync with the locked
 * set. A single instance lives on the shared `obsidian-dev-utils` state. Each lock is one
 * {@link LockEntry} in a per-path list, so a path can be held by several plugins (or several times by
 * one) concurrently and is released only when its last entry is removed; the indicators report which
 * plugins currently hold a lock.
 */
class ResourceLockManager {
  private readonly beeper = new Beeper();
  private readonly bypassPathSets = new Set<ReadonlySet<string>>();
  private eventsComponent: null | ResourceLockEventsComponent = null;
  private readonly indicatorsByView = new Map<MarkdownView, LockIndicators>();
  private readonly lockEntriesByPath = new Map<string, LockEntry[]>();
  private mutationBlockerComponent: null | ResourceLockMutationBlockerComponent = null;
  private statusBarItemEl: HTMLElement | null = null;

  public bypass(app: App, pathsOrFiles: readonly PathOrFile[]): Disposable {
    const bypassedPaths: ReadonlySet<string> = new Set(pathsOrFiles.map((pathOrFile) => getPath(app, pathOrFile)));
    this.bypassPathSets.add(bypassedPaths);
    return new CallbackDisposable({
      callback: (): void => {
        this.bypassPathSets.delete(bypassedPaths);
      },
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
  }

  /**
   * Fully unlocks the note at the given path. Resolves the lock covering it — the path itself when
   * directly locked, otherwise the enclosing `subtree`-locked folder — then aborts every
   * {@link AbortController} registered on that owner (cancelling the operations that took the locks)
   * AND removes the owner's lock entries (releasing the lock unconditionally). Unlike
   * {@link requestUnlock}, which only aborts the exact path's controllers and relies on each operation
   * releasing its own lock, this resolves ancestor coverage and always releases — so a note held by an
   * indefinitely-held lock is guaranteed to become editable. A no-op when nothing covers the path.
   *
   * @param app - The Obsidian app instance.
   * @param pathOrFile - The path or file of the note to unlock.
   */
  public forceUnlock(app: App, pathOrFile: PathOrFile): void {
    const ownerPath = this.resolveLockOwnerPath(app, getPath(app, pathOrFile));
    if (ownerPath === null) {
      return;
    }
    this.abortAndReleaseEntries(app, ownerPath);
  }

  public isLocked(app: App, pathOrFile: PathOrFile): boolean {
    return this.isPathLocked(getPath(app, pathOrFile));
  }

  /**
   * Checks whether the given path is locked directly or is covered by a `subtree`-locked ancestor
   * folder.
   *
   * @param app - The Obsidian app instance.
   * @param pathOrFile - The path or file to check.
   * @returns `true` if the path is itself locked or lies under a `subtree`-locked folder.
   */
  public isLockedByAncestor(app: App, pathOrFile: PathOrFile): boolean {
    return this.resolveLockOwnerPath(app, getPath(app, pathOrFile)) !== null;
  }

  /**
   * Checks whether the given path is covered by a mutation-blocking lock (one taken with
   * `blocksMutations`) directly or on a `subtree`-locked ancestor folder.
   *
   * @param app - The Obsidian app instance.
   * @param pathOrFile - The path or file to check.
   * @returns `true` if a mutation of the path is currently blocked.
   */
  public isMutationBlockedByAncestor(app: App, pathOrFile: PathOrFile): boolean {
    const path = getPath(app, pathOrFile);
    const exactEntries = this.lockEntriesByPath.get(path);
    if (exactEntries?.some((entry) => entry.blocksMutations)) {
      return true;
    }
    for (const [lockedPath, entries] of this.lockEntriesByPath) {
      if (entries.some((entry) => entry.mode === 'subtree' && entry.blocksMutations) && isChild({ app, childPathOrFile: path, parentPathOrFile: lockedPath })) {
        return true;
      }
    }
    return false;
  }

  public lock(params: ManagerLockParams): Disposable {
    const { app } = params;
    const path = getPath(app, params.pathOrFile);
    const entry: LockEntry = {
      abortController: params.abortController ?? null,
      blocksMutations: params.blocksMutations ?? false,
      mode: params.mode ?? 'file',
      onUnlockRequested: params.onUnlockRequested ?? null,
      operationName: params.operationName,
      pluginId: params.pluginId,
      shouldReleaseOnAbort: params.shouldReleaseOnAbort ?? false
    };
    let entries = this.lockEntriesByPath.get(path);
    if (!entries) {
      entries = [];
      this.lockEntriesByPath.set(path, entries);
    }
    entries.push(entry);
    this.ensureSubscribed(app);
    if (entry.blocksMutations) {
      this.ensureBlockerInstalled(app);
    }
    this.wireReleaseOnAbort(app, path, entry);
    this.reconcile(app);

    return new CallbackDisposable({
      callback: (): void => {
        this.removeEntry(app, path, entry);
      },
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
  }

  /**
   * Aborts every {@link AbortController} currently registered for the note at the given path, which
   * cancels the operations holding the lock. Each operation releases its own lock in its `finally`
   * when it observes the abort, so this does not unlock the path directly. A no-op when no controller
   * is registered for the path.
   *
   * @param app - The Obsidian app instance.
   * @param pathOrFile - The path or file of the note to request an unlock for.
   */
  public requestUnlock(app: App, pathOrFile: PathOrFile): void {
    const entries = this.lockEntriesByPath.get(getPath(app, pathOrFile));
    if (!entries) {
      return;
    }
    for (const entry of entries) {
      entry.abortController?.abort();
    }
  }

  public unlock(app: App, pathOrFile: PathOrFile, pluginId: string): void {
    const path = getPath(app, pathOrFile);
    const entries = this.lockEntriesByPath.get(path);
    if (!entries) {
      return;
    }
    const index = entries.findIndex((entry) => entry.pluginId === pluginId);
    if (index === -1) {
      return;
    }
    entries.splice(index, 1);
    if (entries.length === 0) {
      this.lockEntriesByPath.delete(path);
    }
    this.reconcileAndCleanup(app);
  }

  public unlockAllForPlugin(app: App, pluginId: string): void {
    for (const [path, entries] of this.lockEntriesByPath) {
      const remaining = entries.filter((entry) => entry.pluginId !== pluginId);
      if (remaining.length === 0) {
        this.lockEntriesByPath.delete(path);
      } else if (remaining.length !== entries.length) {
        this.lockEntriesByPath.set(path, remaining);
      }
    }
    this.reconcileAndCleanup(app);
  }

  /**
   * Aborts every {@link AbortController} on the given (already-resolved) owner path's lock entries —
   * cancelling the owning operations — and removes those entries, releasing the lock. The entries
   * snapshot is copied first because an entry's `shouldReleaseOnAbort` abort listener mutates the
   * array as it fires. Always leaves the owner path with no entries.
   *
   * @param app - The Obsidian app instance.
   * @param ownerPath - The directly-locked owner path whose entries to abort and release.
   */
  private abortAndReleaseEntries(app: App, ownerPath: string): void {
    const entries = this.lockEntriesByPath.get(ownerPath);
    assertNonNullable(entries);
    for (const entry of [...entries]) {
      entry.abortController?.abort();
    }
    this.lockEntriesByPath.delete(ownerPath);
    this.reconcileAndCleanup(app);
  }

  private addUnlockMenuItem(app: App, menu: Menu, path: string): void {
    menu.addItem((item) => {
      item
        .setTitle(t(($) => $.obsidianDevUtils.resourceLock.unlockMenuItem))
        .setIcon(UNLOCK_ICON_ID)
        .onClick(convertAsyncToSync(async () => {
          const isConfirmed = await confirm({
            app,
            message: this.unlockConfirmMessage(app, path),
            title: t(($) => $.obsidianDevUtils.resourceLock.unlockConfirmTitle)
          });
          if (isConfirmed) {
            // `path` is the resolved owner path, so cancel its operations and release the lock outright.
            this.abortAndReleaseEntries(app, path);
          }
        }));
    });
  }

  private createIndicators(app: App, view: MarkdownView, path: string, tooltip: string): LockIndicators {
    const actionIconEl = view.addAction(LOCK_ICON_ID, tooltip, noop);
    this.registerUnlockMenu(app, actionIconEl, () => path);

    let tabIconEl: HTMLElement | null = null;
    const tabStatusContainerEl = view.leaf.tabHeaderStatusContainerEl;
    if (tabStatusContainerEl) {
      tabIconEl = tabStatusContainerEl.createSpan({ cls: LOCK_INDICATOR_CSS_CLASS });
      setIcon(tabIconEl, LOCK_ICON_ID);
      setTooltip(tabIconEl, tooltip);
      this.registerUnlockMenu(app, tabIconEl, () => path);
    }

    // A locked view is read-only but still editable-focusable, so a keystroke fires `beforeinput`.
    // On that rejected attempt, flash the indicators and beep so it's clear the note is locked.
    // The listener is removed on unlock.
    const onTypeAttempt = (): void => {
      this.flashIndicators(view);
      this.beeper.beep();
    };
    view.contentEl.addEventListener('beforeinput', onTypeAttempt);

    return {
      actionIconEl,
      disposeTypeListener: (): void => {
        view.contentEl.removeEventListener('beforeinput', onTypeAttempt);
      },
      tabIconEl
    };
  }

  private ensureBlockerInstalled(app: App): void {
    if (this.mutationBlockerComponent) {
      return;
    }
    this.mutationBlockerComponent = new ResourceLockMutationBlockerComponent({
      shouldBlockMutation: (path): boolean => this.shouldBlockMutation(app, path)
    });
    this.mutationBlockerComponent.load();
  }

  private ensureSubscribed(app: App): void {
    if (this.eventsComponent) {
      return;
    }
    this.eventsComponent = new ResourceLockEventsComponent({
      app,
      onChange: (): void => {
        this.reconcile(app);
      },
      onExternalMutation: (path): void => {
        this.handleExternalMutation(app, path);
      },
      onFileMenu: (menu, file): void => {
        this.handleFileMenu(app, menu, file);
      }
    });
    this.eventsComponent.load();
  }

  private flashElement(el: HTMLElement): void {
    el.removeClass(LOCK_INDICATOR_FLASH_CSS_CLASS);
    // Read layout to force a reflow so the flash animation restarts on every rejected keystroke.
    el.getBoundingClientRect();
    el.addClass(LOCK_INDICATOR_FLASH_CSS_CLASS);
  }

  private flashIndicators(view: MarkdownView): void {
    const indicators = this.indicatorsByView.get(view);
    for (const el of [indicators?.actionIconEl, indicators?.tabIconEl, this.statusBarItemEl]) {
      if (el) {
        this.flashElement(el);
      }
    }
  }

  /**
   * Reacts to a vault/metadata event on a path. If the path is mutation-blocked and NOT covered by an
   * active bypass scope, the change bypassed the blocker patch (sync / filesystem / a raw-adapter
   * write) — an intruder. Abort the `abortController` of every mutation-blocking lock covering the path
   * so the owning operation cancels and rolls back. A no-op for the owner's own (bypassed) mutations,
   * for unblocked paths, and for blocking locks with no `abortController`.
   *
   * @param app - The Obsidian app instance.
   * @param path - The path the event fired on.
   */
  private handleExternalMutation(app: App, path: string): void {
    if (!this.isMutationBlockedByAncestor(app, path)) {
      return;
    }
    if (this.isBypassed(app, path)) {
      return;
    }
    for (const [lockedPath, entries] of this.lockEntriesByPath) {
      for (const entry of entries) {
        if (!entry.blocksMutations || !entry.abortController) {
          continue;
        }
        const coversPath = lockedPath === path || (entry.mode === 'subtree' && isChild({ app, childPathOrFile: path, parentPathOrFile: lockedPath }));
        if (coversPath) {
          entry.abortController.abort();
        }
      }
    }
  }

  private handleFileMenu(app: App, menu: Menu, file: TAbstractFile): void {
    // Offer "Unlock" for a directly-locked file/folder, or anything covered by a `subtree` lock on an ancestor. The menu targets the owner lock's path.
    const ownerPath = this.resolveLockOwnerPath(app, file.path);
    if (ownerPath === null) {
      return;
    }
    this.addUnlockMenuItem(app, menu, ownerPath);
  }

  private hasBlockingLock(): boolean {
    for (const entries of this.lockEntriesByPath.values()) {
      if (entries.some((entry) => entry.blocksMutations)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether the path is covered by an active {@link ResourceLockManager.bypass} scope — the
   * owner declaring that its own mutations of the path (and, for a folder, its subtree) are sanctioned.
   *
   * @param app - The Obsidian app instance.
   * @param path - The path being mutated.
   * @returns `true` if some active bypass scope covers the path.
   */
  private isBypassed(app: App, path: string): boolean {
    for (const bypassedPaths of this.bypassPathSets) {
      for (const bypassedPath of bypassedPaths) {
        if (isChildOrSelf({ app, childPathOrFile: path, parentPathOrFile: bypassedPath })) {
          return true;
        }
      }
    }
    return false;
  }

  private isPathLocked(path: string): boolean {
    return (this.lockEntriesByPath.get(path)?.length ?? 0) > 0;
  }

  /**
   * Builds the deduplicated list of `(plugin name, operation name)` pairs describing the locks on a
   * path — one per distinct plugin+operation. Drives the unlock confirmation, so the user sees exactly
   * which operations an unlock would cancel. Only ever called for a locked path, so its entries are
   * always present.
   *
   * @param app - The Obsidian app instance.
   * @param path - The directly-locked path whose lock descriptors to build.
   * @returns The distinct lock descriptors covering the path.
   */
  private lockDescriptors(app: App, path: string): LockDescriptor[] {
    const entries = this.lockEntriesByPath.get(path);
    assertNonNullable(entries);
    const seen = new Set<string>();
    const descriptors: LockDescriptor[] = [];
    for (const entry of entries) {
      const pluginName = app.plugins.manifests[entry.pluginId]?.name ?? entry.pluginId;
      const key = `${pluginName}\n${entry.operationName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      descriptors.push({ operationName: entry.operationName, pluginName });
    }
    return descriptors;
  }

  private lockingPluginNames(app: App, path: string): string[] {
    const entries = this.lockEntriesByPath.get(path);
    // `lockingPluginNames` is only ever called for a locked path, so its entries are always present.
    assertNonNullable(entries);
    const pluginIds = [...new Set(entries.map((entry) => entry.pluginId))];
    return pluginIds.map((pluginId) => app.plugins.manifests[pluginId]?.name ?? pluginId);
  }

  private lockTooltip(app: App, path: string): string {
    const header = t(($) => $.obsidianDevUtils.resourceLock.lockedByTooltip);
    // A runtime-length list of plugin names, one per line under the header.
    return [header, ...this.lockingPluginNames(app, path)].join('\n');
  }

  private reconcile(app: App): void {
    const viewsToLock = new Set<MarkdownView>();
    for (const leaf of app.workspace.getLeavesOfType(ViewType.Markdown)) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        continue;
      }

      const path = view.file?.path;
      if (path === undefined) {
        continue;
      }

      // Resolve the lock covering this view: the exact path when directly locked, otherwise the enclosing `subtree`-locked folder. Indicators/tooltip/unlock menu key off that owner path.
      const ownerPath = this.resolveLockOwnerPath(app, path);
      if (ownerPath !== null) {
        viewsToLock.add(view);
        const tooltip = this.lockTooltip(app, ownerPath);
        // Re-apply the read-only toggle on every reconcile, not only the first time a view is tracked.
        // The toggle is idempotent, so re-applying to an already-locked view is cheap.
        // A view opened after the lock is reconciled synchronously, before its CodeMirror is ready.
        // Its first toggle is therefore a no-op; re-applying makes the lock take hold once it settles.
        toggleEditorReadOnly(view.editor, true);
        const indicators = this.indicatorsByView.get(view);
        if (indicators) {
          this.updateIndicatorTooltips(indicators, tooltip);
        } else {
          this.indicatorsByView.set(view, this.createIndicators(app, view, ownerPath, tooltip));
        }
      }
    }

    for (const [view, indicators] of this.indicatorsByView) {
      if (!viewsToLock.has(view)) {
        toggleEditorReadOnly(view.editor, false);
        indicators.disposeTypeListener();
        indicators.actionIconEl.remove();
        indicators.tabIconEl?.remove();
        this.indicatorsByView.delete(view);
      }
    }

    this.updateStatusBar(app);
  }

  private reconcileAndCleanup(app: App): void {
    this.reconcile(app);
    if (this.lockEntriesByPath.size === 0) {
      this.eventsComponent?.unload();
      this.eventsComponent = null;
    }
    if (!this.hasBlockingLock()) {
      this.mutationBlockerComponent?.unload();
      this.mutationBlockerComponent = null;
    }
  }

  private registerUnlockMenu(app: App, el: HTMLElement, getContextPath: () => string | undefined): void {
    // A click of ANY mouse button on a lock indicator opens the same unlock context menu:
    // `click` fires only for the primary (left) button, `contextmenu` for the right button, and
    // `auxclick` for the middle button (the browser fires no `click` for it). `auxclick` also fires for
    // The right button, so it is guarded to the middle button to avoid double-opening alongside `contextmenu`.
    // A plain listener dies with the element when it is `.remove()`d on unlock, so it never leaks.
    const openUnlockMenu = (evt: MouseEvent): void => {
      evt.preventDefault();
      const path = getContextPath();
      if (path === undefined) {
        return;
      }
      const menu = new Menu();
      this.addUnlockMenuItem(app, menu, path);
      menu.showAtMouseEvent(evt);
    };
    el.addEventListener('click', openUnlockMenu);
    el.addEventListener('contextmenu', openUnlockMenu);
    el.addEventListener('auxclick', (evt) => {
      if (evt.button === MIDDLE_MOUSE_BUTTON) {
        openUnlockMenu(evt);
      }
    });
  }

  private removeEntry(app: App, path: string, entry: LockEntry): void {
    const entries = this.lockEntriesByPath.get(path);
    if (!entries) {
      return;
    }
    const index = entries.indexOf(entry);
    if (index === -1) {
      return;
    }
    entries.splice(index, 1);
    if (entries.length === 0) {
      this.lockEntriesByPath.delete(path);
    }
    this.reconcileAndCleanup(app);
  }

  /**
   * Resolves which locked path (if any) covers the given path: the path itself when directly locked,
   * otherwise the longest `subtree`-locked ancestor folder that contains it (longest so a nested
   * subtree lock wins deterministically over an outer one).
   *
   * @param app - The Obsidian app instance.
   * @param path - The path to resolve an owner lock for.
   * @returns The covering locked path, or `null` when nothing covers it.
   */
  private resolveLockOwnerPath(app: App, path: string): null | string {
    if (this.isPathLocked(path)) {
      return path;
    }
    let bestOwnerPath: null | string = null;
    for (const [lockedPath, entries] of this.lockEntriesByPath) {
      const hasSubtreeLock = entries.some((entry) => entry.mode === 'subtree');
      if (hasSubtreeLock && isChild({ app, childPathOrFile: path, parentPathOrFile: lockedPath }) && (bestOwnerPath === null || lockedPath.length > bestOwnerPath.length)) {
        bestOwnerPath = lockedPath;
      }
    }
    return bestOwnerPath;
  }

  /**
   * Decides whether a mutation of the path must be blocked: `true` when the path is mutation-blocked
   * and not covered by any active {@link ResourceLockManager.bypass} scope.
   *
   * @param app - The Obsidian app instance.
   * @param path - The path being mutated.
   * @returns `true` to reject the mutation, `false` to allow it.
   */
  private shouldBlockMutation(app: App, path: string): boolean {
    if (!this.isMutationBlockedByAncestor(app, path)) {
      return false;
    }
    return !this.isBypassed(app, path);
  }

  private unlockConfirmMessage(app: App, path: string): DocumentFragment {
    const fragment = createFragment();
    fragment.appendText(t(($) => $.obsidianDevUtils.resourceLock.unlockConfirmMessage));
    // A runtime-length list of the locks currently held: each plugin name as a code block followed by
    // The operation it is running, one per line.
    for (const descriptor of this.lockDescriptors(app, path)) {
      fragment.createEl('br');
      appendCodeBlock(fragment, descriptor.pluginName);
      fragment.appendText(`: ${descriptor.operationName}`);
    }
    return fragment;
  }

  private updateIndicatorTooltips(indicators: LockIndicators, tooltip: string): void {
    setTooltip(indicators.actionIconEl, tooltip);
    if (indicators.tabIconEl) {
      setTooltip(indicators.tabIconEl, tooltip);
    }
  }

  private updateStatusBar(app: App): void {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    const activePath = activeView?.file?.path;
    const activeOwnerPath = activePath === undefined ? null : this.resolveLockOwnerPath(app, activePath);

    if (activeOwnerPath === null || !activeView) {
      this.statusBarItemEl?.remove();
      this.statusBarItemEl = null;
      return;
    }

    if (!this.statusBarItemEl) {
      const statusBarEl = activeView.containerEl.ownerDocument.body.querySelector<HTMLElement>(STATUS_BAR_CSS_SELECTOR);
      if (!statusBarEl) {
        return;
      }
      this.statusBarItemEl = statusBarEl.createDiv({ cls: [STATUS_BAR_ITEM_CSS_CLASS, LOCK_INDICATOR_CSS_CLASS] });
      setIcon(this.statusBarItemEl, LOCK_ICON_ID);
      // The single status-bar item is reused across active-note switches.
      // It must resolve the currently active note's owner lock at click time rather than capturing one path.
      this.registerUnlockMenu(app, this.statusBarItemEl, () => {
        const path = app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
        return path === undefined ? undefined : this.resolveLockOwnerPath(app, path) ?? undefined;
      });
    }

    setTooltip(this.statusBarItemEl, this.lockTooltip(app, activeOwnerPath));
  }

  /**
   * Wires an opt-in `abort` listener for a lock entry: when the entry's controller aborts, releases
   * the entry (if {@link LockEntry.shouldReleaseOnAbort}) and/or invokes
   * {@link LockEntry.onUnlockRequested}. A no-op when the entry has no controller or neither opt-in is
   * set, so transactional locks keep releasing via their own cleanup.
   *
   * @param app - The Obsidian app instance.
   * @param path - The exact path the entry is registered under.
   * @param entry - The lock entry whose controller to observe.
   */
  private wireReleaseOnAbort(app: App, path: string, entry: LockEntry): void {
    const { onUnlockRequested, shouldReleaseOnAbort } = entry;
    if (!entry.abortController || (!shouldReleaseOnAbort && !onUnlockRequested)) {
      return;
    }
    entry.abortController.signal.addEventListener('abort', () => {
      if (shouldReleaseOnAbort) {
        this.removeEntry(app, path, entry);
      }
      onUnlockRequested?.();
    }, { once: true });
  }
}

/**
 * A per-plugin handle for path-scoped resource locking (editor read-only, optional vault-mutation
 * blocking, and external-change detection — see the file overview). Add it as a child of your plugin
 * (`this.addChild(new ResourceLockComponent(this.app))`) so that any locks it still holds are released
 * automatically when the plugin unloads — a resource can never be left stuck locked because the plugin
 * that locked it was disabled or reloaded mid-operation.
 *
 * Locks are reference-counted and attributed to this plugin, so the lock indicators' tooltip names it
 * among the plugins currently holding a lock.
 */
export class ResourceLockComponent extends ComponentEx {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The id of the owning plugin (e.g. its `manifest.id`). Locks are attributed to it for
   * reference-counting and the indicators' "locked by" tooltip.
   */
  protected readonly pluginId: string;

  /**
   * Creates an resource-lock handle owned by a plugin.
   *
   * @param app - The Obsidian app instance.
   * @param pluginId - The id of the owning plugin (e.g. its `manifest.id`). Locks are attributed to
   * it for reference-counting and the indicators' "locked by" tooltip.
   */
  public constructor(app: App, pluginId: string) {
    super();
    this.app = app;
    this.pluginId = pluginId;
  }

  /**
   * Opens an **ambient bypass scope**: while the returned {@link Disposable} is not disposed, this
   * plugin's own mutations of the given paths (and, for a folder, its whole subtree) pass through the
   * mutation blocker instead of throwing {@link ResourceLockedError}. Any mutation of a blocked path
   * NOT covered by an active bypass scope is still rejected. Use it with a `using` declaration around
   * the operation that legitimately mutates resources it has locked with
   * {@link ResourceLockComponentLockForPathParams.shouldBlockMutations}:
   *
   * ```ts
   * using _bypass = component.bypassBlockedMutations([sourceFile, targetFile]);
   * // ... the operation's own vault mutations of those paths are allowed ...
   * // scope end: the paths are enforced again
   * ```
   *
   * @param pathsOrFiles - The paths (or files/folders) whose mutation by this operation is sanctioned.
   * @returns A {@link Disposable} that ends the bypass scope when disposed.
   */
  public bypassBlockedMutations(pathsOrFiles: readonly PathOrFile[]): Disposable {
    return getManager().bypass(this.app, pathsOrFiles);
  }

  /**
   * Checks whether the path is locked directly or lies under a `subtree`-locked ancestor folder.
   *
   * @param pathOrFile - The path or file to check.
   * @returns `true` if the path is itself locked or is covered by a `subtree` lock on an ancestor.
   */
  public isLockedByAncestorForPath(pathOrFile: PathOrFile): boolean {
    return getManager().isLockedByAncestor(this.app, pathOrFile);
  }

  /**
   * Checks whether the note at the given path is currently locked by any plugin.
   *
   * @param pathOrFile - The path or file of the note to check.
   * @returns `true` if the note has at least one active lock, `false` otherwise.
   */
  public isLockedForPath(pathOrFile: PathOrFile): boolean {
    return getManager().isLocked(this.app, pathOrFile);
  }

  /**
   * Checks whether a vault mutation of the path is currently blocked by a `shouldBlockMutations` lock
   * on the path itself or on a `subtree`-locked ancestor folder.
   *
   * @param pathOrFile - The path or file to check.
   * @returns `true` if editing/deleting/renaming/moving/creating the path would throw a
   * {@link ResourceLockedError}.
   */
  public isMutationBlockedByAncestorForPath(pathOrFile: PathOrFile): boolean {
    return getManager().isMutationBlockedByAncestor(this.app, pathOrFile);
  }

  /**
   * Locks the note at the given path on behalf of this plugin, making it read-only in every current
   * and future {@link MarkdownView} until the lock is released. Reference-counted: balance each call
   * with a dispose of the returned {@link Disposable} (ideally via `using`) or {@link unlockForPath}.
   *
   * @param params - Locking parameters. Its {@link ResourceLockComponentLockForPathParams.pathOrFile}
   * and {@link ResourceLockComponentLockForPathParams.operationName} are required (the latter is shown
   * in the unlock confirmation). Pass an {@link ResourceLockComponentLockForPathParams.abortController}
   * to make the lock cancelable via a lock indicator's "unlock" menu, the "Unlock active note" command,
   * or {@link requestResourceUnlockForPath}.
   * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
   */
  public lockForPath(params: ResourceLockComponentLockForPathParams): Disposable {
    return getManager().lock({
      abortController: params.abortController,
      app: this.app,
      blocksMutations: params.shouldBlockMutations,
      mode: params.mode,
      onUnlockRequested: params.onUnlockRequested,
      operationName: params.operationName,
      pathOrFile: params.pathOrFile,
      pluginId: this.pluginId,
      shouldReleaseOnAbort: params.shouldReleaseOnAbort
    });
  }

  /**
   * Releases every lock still held by this plugin when the component (and thus the plugin) unloads,
   * so no note is left stuck read-only by an operation that never completed.
   */
  public override onunload(): void {
    getManager().unlockAllForPlugin(this.app, this.pluginId);
    super.onunload();
  }

  /**
   * Fully unlocks the note at the given path: resolves the lock covering it (the path itself when
   * directly locked, otherwise a `subtree`-locked ancestor folder), cancels the operation(s) that took
   * the lock by aborting their {@link AbortController}s, and releases the lock so the note becomes
   * editable — regardless of which plugin holds the lock. Powers the "Unlock active note" command. A
   * no-op when nothing covers the path.
   *
   * @param pathOrFile - The path or file of the note to unlock.
   */
  public requestUnlockForPath(pathOrFile: PathOrFile): void {
    getManager().forceUnlock(this.app, pathOrFile);
  }

  /**
   * Releases one lock previously acquired for the note at the given path via {@link lockForPath}.
   *
   * @param pathOrFile - The path or file of the note to unlock.
   */
  public unlockForPath(pathOrFile: PathOrFile): void {
    getManager().unlock(this.app, pathOrFile, this.pluginId);
  }
}

/**
 * Thrown by the vault-mutation blocker when a plugin tries to edit, delete, rename, move, or create a
 * resource whose path is covered by a lock taken with
 * {@link ResourceLockComponentLockForPathParams.shouldBlockMutations}.
 */
export class ResourceLockedError extends Error {
  /**
   * The vault path whose mutation was blocked.
   */
  public readonly path: string;

  /**
   * Creates a {@link ResourceLockedError}.
   *
   * @param path - The vault path whose mutation was blocked.
   */
  public constructor(path: string) {
    super(`The resource "${path}" is locked and cannot be mutated.`);
    this.name = 'ResourceLockedError';
    this.path = path;
  }
}

/**
 * Checks whether the note at the given path is currently locked.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to check.
 * @returns `true` if the note has at least one active lock, `false` otherwise.
 */
export function isResourceLockedForPath(app: App, pathOrFile: PathOrFile): boolean {
  return getManager().isLocked(app, pathOrFile);
}

/**
 * Locks the note at the given path, making it read-only in every current and future
 * {@link MarkdownView} until the lock is released, and showing a lock indicator in the tab header,
 * view action bar, and (while active) the status bar. The indicators' tooltip lists the plugins
 * that currently hold a lock on the note.
 *
 * The lock is reference-counted per calling plugin: each call must be balanced by exactly one
 * release (either disposing the returned {@link Disposable} — ideally via a `using` declaration — or
 * a matching {@link unlockResourceForPath} call).
 *
 * @param params - The parameters for locking the note.
 * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
 */
export function lockResourceForPath(params: LockResourceForPathParams): Disposable {
  return getManager().lock({
    app: params.app,
    operationName: params.operationName,
    pathOrFile: params.pathOrFile,
    pluginId: params.pluginId
  });
}

/**
 * Requests an unlock of the note at the given path by aborting every {@link AbortController} that was
 * associated with a lock on it (via {@link ResourceLockComponent.lockForPath}'s
 * {@link ResourceLockComponentLockForPathParams.abortController}). The operations holding the lock
 * observe the abort and release their own locks. A no-op when no abortable lock is registered for the
 * path.
 *
 * This lets a consuming plugin wire its own "unlock active note" command without reaching into the
 * lock manager directly.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to request an unlock for.
 */
export function requestResourceUnlockForPath(app: App, pathOrFile: PathOrFile): void {
  getManager().requestUnlock(app, pathOrFile);
}

/**
 * Releases one lock previously acquired for the note at the given path via {@link lockResourceForPath}.
 *
 * When the last lock is released the note becomes fully editable again and its lock indicators are
 * removed. Calling this when the note is not locked is a no-op.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to unlock.
 * @param pluginId - The id of the plugin that holds the lock (e.g. its `manifest.id`); one of its
 * locks on the note is released.
 */
export function unlockResourceForPath(app: App, pathOrFile: PathOrFile, pluginId: string): void {
  getManager().unlock(app, pathOrFile, pluginId);
}

function getManager(): ResourceLockManager {
  return getObsidianDevUtilsState<ResourceLockManager>(RESOURCE_LOCK_STATE_KEY, new ResourceLockManager()).value;
}
