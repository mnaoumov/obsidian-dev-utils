/**
 * @file
 *
 * Note-scoped, reference-counted editor locking.
 *
 * Where {@link lockEditor} / {@link unlockEditor} from `./editor.ts` toggle the read-only state of a
 * single {@link Editor} instance, the helpers here lock a note by its **path**: while a path is
 * locked, every current and future {@link MarkdownView} of that note (in any window, including
 * popouts) is made read-only and shows a lock indicator in its tab header, its view action bar, and
 * the status bar (while the note is active). Locks are reference-counted per locking plugin, so
 * nested or concurrent operations on the same note are safe — the note is unlocked only when the
 * last lock is released — and the indicators' tooltip lists which plugins currently hold a lock.
 *
 * The acquirers return a {@link Disposable}, so the preferred call style is a `using` declaration
 * that releases automatically at scope exit (including on throw):
 *
 * ```ts
 * using _lock = lockEditorForPath(app, path);
 * // ... long-running work (process, processFrontMatter, merge/split) ...
 * // auto-unlocked at scope exit
 * ```
 *
 * The explicit {@link unlockEditorForPath} pair remains available for non-`using` call sites.
 */

import type { App } from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  MarkdownView,
  setIcon,
  setTooltip
} from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from '../disposable.ts';
import { noop } from '../function.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { assertNonNullable } from '../type-guards.ts';
import { ComponentEx } from './components/component-ex.ts';
import {
  lockEditor,
  unlockEditor
} from './editor.ts';
import { getPath } from './file-system.ts';
import { t } from './i18n/i18n.ts';
import { getPluginId } from './plugin/plugin-id.ts';

const EDITOR_LOCK_STATE_KEY = 'editorLock';
const LOCK_ICON_ID = 'lock';
const LOCK_INDICATOR_CSS_CLASS = 'obsidian-dev-utils-lock-indicator';
const STATUS_BAR_ITEM_CSS_CLASS = 'status-bar-item';
const STATUS_BAR_CSS_SELECTOR = '.status-bar';

interface LockIndicators {
  readonly actionIconEl: HTMLElement;
  readonly tabIconEl: HTMLElement | null;
}

/**
 * Subscribes to the workspace events that should trigger a lock reconcile. Implemented as a
 * {@link ComponentEx} so the subscriptions are registered on `load()` and automatically removed on
 * `unload()`, instead of being tracked and torn down by hand.
 */
class EditorLockEventsComponent extends ComponentEx {
  public constructor(private readonly app: App, private readonly onChange: () => void) {
    super();
  }

  public override onload(): void {
    super.onload();
    this.registerEvent(this.app.workspace.on('active-leaf-change', this.onChange));
    this.registerEvent(this.app.workspace.on('layout-change', this.onChange));
    // Same-leaf navigation to another note fires no leaf/layout change; without this it stays read-only.
    this.registerEvent(this.app.workspace.on('file-open', this.onChange));
  }
}

/**
 * Tracks reference-counted, path-scoped editor locks and keeps every open {@link MarkdownView} in
 * sync with the locked-path set. A single instance lives on the shared `obsidian-dev-utils` state.
 * For each locked path the lock count is tracked per locking plugin, so the indicators can report
 * which plugins currently hold a lock.
 */
class EditorPathLockManager {
  private eventsComponent: EditorLockEventsComponent | undefined;
  private readonly indicatorsByView = new Map<MarkdownView, LockIndicators>();
  private readonly lockCountByPluginIdByPath = new Map<string, Map<string, number>>();
  private statusBarItemEl: HTMLElement | null = null;

  public isLocked(app: App, pathOrFile: PathOrFile): boolean {
    return this.isPathLocked(getPath(app, pathOrFile));
  }

  public lock(app: App, pathOrFile: PathOrFile, pluginId: string): Disposable {
    const path = getPath(app, pathOrFile);
    let lockCountByPluginId = this.lockCountByPluginIdByPath.get(path);
    if (!lockCountByPluginId) {
      lockCountByPluginId = new Map<string, number>();
      this.lockCountByPluginIdByPath.set(path, lockCountByPluginId);
    }
    lockCountByPluginId.set(pluginId, (lockCountByPluginId.get(pluginId) ?? 0) + 1);
    this.ensureSubscribed(app);
    this.reconcile(app);

    return new CallbackDisposable({
      callback: (): void => {
        this.unlockPath(app, path, pluginId);
      },
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
  }

  public unlock(app: App, pathOrFile: PathOrFile, pluginId: string): void {
    this.unlockPath(app, getPath(app, pathOrFile), pluginId);
  }

  public unlockAllForPlugin(app: App, pluginId: string): void {
    for (const [path, lockCountByPluginId] of this.lockCountByPluginIdByPath) {
      if (lockCountByPluginId.delete(pluginId) && lockCountByPluginId.size === 0) {
        this.lockCountByPluginIdByPath.delete(path);
      }
    }
    this.reconcileAndCleanup(app);
  }

  private createIndicators(view: MarkdownView, tooltip: string): LockIndicators {
    const actionIconEl = view.addAction(LOCK_ICON_ID, tooltip, noop);

    let tabIconEl: HTMLElement | null = null;
    const tabStatusContainerEl = view.leaf.tabHeaderStatusContainerEl;
    if (tabStatusContainerEl) {
      tabIconEl = tabStatusContainerEl.createSpan({ cls: LOCK_INDICATOR_CSS_CLASS });
      setIcon(tabIconEl, LOCK_ICON_ID);
      setTooltip(tabIconEl, tooltip);
    }

    return {
      actionIconEl,
      tabIconEl
    };
  }

  private ensureSubscribed(app: App): void {
    if (this.eventsComponent) {
      return;
    }
    this.eventsComponent = new EditorLockEventsComponent(app, () => {
      this.reconcile(app);
    });
    this.eventsComponent.load();
  }

  private isPathLocked(path: string): boolean {
    return (this.lockCountByPluginIdByPath.get(path)?.size ?? 0) > 0;
  }

  private lockTooltip(app: App, path: string): string {
    const lockCountByPluginId = this.lockCountByPluginIdByPath.get(path);
    // `lockTooltip` is only ever called for a locked path, so the per-plugin map is always present.
    assertNonNullable(lockCountByPluginId);
    const header = t(($) => $.obsidianDevUtils.editorLock.lockedByTooltip);
    const pluginNames = Array.from(lockCountByPluginId.keys()).map((pluginId) => app.plugins.manifests[pluginId]?.name ?? pluginId);
    // A runtime-length list of plugin names, one per line under the header.
    return [header, ...pluginNames].join('\n');
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

      if (this.isPathLocked(path)) {
        viewsToLock.add(view);
        const tooltip = this.lockTooltip(app, path);
        const indicators = this.indicatorsByView.get(view);
        if (indicators) {
          this.updateIndicatorTooltips(indicators, tooltip);
        } else {
          lockEditor(view.editor);
          this.indicatorsByView.set(view, this.createIndicators(view, tooltip));
        }
      }
    }

    for (const [view, indicators] of this.indicatorsByView) {
      if (!viewsToLock.has(view)) {
        unlockEditor(view.editor);
        indicators.actionIconEl.remove();
        indicators.tabIconEl?.remove();
        this.indicatorsByView.delete(view);
      }
    }

    this.updateStatusBar(app);
  }

  private reconcileAndCleanup(app: App): void {
    this.reconcile(app);
    if (this.lockCountByPluginIdByPath.size === 0) {
      this.eventsComponent?.unload();
      this.eventsComponent = undefined;
    }
  }

  private unlockPath(app: App, path: string, pluginId: string): void {
    const lockCountByPluginId = this.lockCountByPluginIdByPath.get(path);
    if (!lockCountByPluginId) {
      return;
    }

    const count = lockCountByPluginId.get(pluginId) ?? 0;
    if (count <= 0) {
      return;
    }

    if (count === 1) {
      lockCountByPluginId.delete(pluginId);
    } else {
      lockCountByPluginId.set(pluginId, count - 1);
    }

    if (lockCountByPluginId.size === 0) {
      this.lockCountByPluginIdByPath.delete(path);
    }

    this.reconcileAndCleanup(app);
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
    const isActiveLocked = activePath !== undefined && this.isPathLocked(activePath);

    if (!isActiveLocked || !activeView) {
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
    }

    setTooltip(this.statusBarItemEl, this.lockTooltip(app, activePath));
  }
}

/**
 * A per-plugin handle for note-scoped editor locking. Add it as a child of your plugin
 * (`this.addChild(new EditorLockComponent(this.app))`) so that any locks it still holds are released
 * automatically when the plugin unloads — a note can never be left stuck read-only because the
 * plugin that locked it was disabled or reloaded mid-operation.
 *
 * Locks are reference-counted and attributed to this plugin, so the lock indicators' tooltip names
 * it among the plugins currently holding a lock.
 */
export class EditorLockComponent extends ComponentEx {
  private readonly app: App;
  private readonly pluginId: string;

  /**
   * Creates an editor-lock handle owned by a plugin.
   *
   * @param app - The Obsidian app instance.
   * @param pluginId - The id of the owning plugin. Defaults to the current plugin context's id; pass
   * it explicitly (e.g. from a plugin's `manifest.id`) when constructing before the plugin context is
   * initialized, such as inside `PluginBase.onload`.
   */
  public constructor(app: App, pluginId: string = getPluginId()) {
    super();
    this.app = app;
    this.pluginId = pluginId;
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
   * Locks the note at the given path on behalf of this plugin, making it read-only in every current
   * and future {@link MarkdownView} until the lock is released. Reference-counted: balance each call
   * with a dispose of the returned {@link Disposable} (ideally via `using`) or {@link unlockForPath}.
   *
   * @param pathOrFile - The path or file of the note to lock.
   * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
   */
  public lockForPath(pathOrFile: PathOrFile): Disposable {
    return getManager().lock(this.app, pathOrFile, this.pluginId);
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
   * Releases one lock previously acquired for the note at the given path via {@link lockForPath}.
   *
   * @param pathOrFile - The path or file of the note to unlock.
   */
  public unlockForPath(pathOrFile: PathOrFile): void {
    getManager().unlock(this.app, pathOrFile, this.pluginId);
  }
}

/**
 * Checks whether the note at the given path is currently locked.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to check.
 * @returns `true` if the note has at least one active lock, `false` otherwise.
 */
export function isEditorLockedForPath(app: App, pathOrFile: PathOrFile): boolean {
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
 * a matching {@link unlockEditorForPath} call).
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to lock.
 * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
 */
export function lockEditorForPath(app: App, pathOrFile: PathOrFile): Disposable {
  return getManager().lock(app, pathOrFile, getPluginId());
}

/**
 * Releases one lock previously acquired for the note at the given path via {@link lockEditorForPath}.
 *
 * When the last lock is released the note becomes fully editable again and its lock indicators are
 * removed. Calling this when the note is not locked is a no-op.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to unlock.
 */
export function unlockEditorForPath(app: App, pathOrFile: PathOrFile): void {
  getManager().unlock(app, pathOrFile, getPluginId());
}

function getManager(): EditorPathLockManager {
  return getObsidianDevUtilsState<EditorPathLockManager>(EDITOR_LOCK_STATE_KEY, new EditorPathLockManager()).value;
}
