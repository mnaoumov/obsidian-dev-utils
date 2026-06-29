/**
 * @file
 *
 * Note-scoped, reference-counted editor locking.
 *
 * Where {@link toggleEditorReadOnly} from `./editor.ts` toggles the read-only state of a single
 * {@link Editor} instance, the helpers here lock a note by its **path**: while a path is
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

import type {
  App,
  TAbstractFile
} from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  MarkdownView,
  Menu,
  setIcon,
  setTooltip,
  TFile
} from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import { convertAsyncToSync } from '../async.ts';
import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from '../disposable.ts';
import { noop } from '../function.ts';
import { appendCodeBlock } from '../html-element.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { assertNonNullable } from '../type-guards.ts';
import { ComponentEx } from './components/component-ex.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { getPath } from './file-system.ts';
import { t } from './i18n/i18n.ts';
import { confirm } from './modals/confirm.ts';
import { getPluginId } from './plugin/plugin-id.ts';

const BEEP_DURATION_SECONDS = 0.08;
const BEEP_FREQUENCY_HZ = 660;
const BEEP_GAIN = 0.05;
const BEEP_THROTTLE_MILLISECONDS = 200;
const EDITOR_LOCK_STATE_KEY = 'editorLock';
const LOCK_ICON_ID = 'lock';
const LOCK_INDICATOR_CSS_CLASS = 'obsidian-dev-utils-lock-indicator';
const LOCK_INDICATOR_FLASH_CSS_CLASS = 'obsidian-dev-utils-lock-indicator-flash';
const STATUS_BAR_ITEM_CSS_CLASS = 'status-bar-item';
const STATUS_BAR_CSS_SELECTOR = '.status-bar';
const UNLOCK_ICON_ID = 'unlock';

/**
 * Options for {@link EditorLockComponent.lockForPath}.
 */
export interface EditorLockComponentLockForPathOptions {
  /**
   * An optional {@link AbortController} associated with the lock. When the lock indicator is
   * right-clicked and the user confirms an unlock (or {@link requestEditorUnlockForPath} is called for
   * the path), this controller is aborted so the operation holding the lock can cancel itself and
   * release the lock in its own cleanup.
   */
  readonly abortController?: AbortController;
}

/**
 * Constructor parameters for {@link EditorLockEventsComponent}.
 */
interface EditorLockEventsComponentConstructorParams {
  readonly app: App;
  onChange(this: void): void;
  onFileMenu(this: void, menu: Menu, file: TAbstractFile): void;
}

interface LockIndicators {
  readonly actionIconEl: HTMLElement;
  disposeTypeListener(): void;
  readonly tabIconEl: HTMLElement | null;
}

/**
 * Subscribes to the workspace events that should trigger a lock reconcile (and the file context-menu
 * event that offers an "Unlock" item). Implemented as a {@link ComponentEx} so the subscriptions are
 * registered on `load()` and automatically removed on `unload()`, instead of being tracked by hand.
 */
class EditorLockEventsComponent extends ComponentEx {
  private readonly app: App;
  private readonly onChange: () => void;
  private readonly onFileMenu: (menu: Menu, file: TAbstractFile) => void;

  public constructor(params: EditorLockEventsComponentConstructorParams) {
    super();
    this.app = params.app;
    this.onChange = params.onChange;
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
  }
}

/**
 * Tracks reference-counted, path-scoped editor locks and keeps every open {@link MarkdownView} in
 * sync with the locked-path set. A single instance lives on the shared `obsidian-dev-utils` state.
 * For each locked path the lock count is tracked per locking plugin, so the indicators can report
 * which plugins currently hold a lock.
 */
class EditorPathLockManager {
  private readonly abortControllersByPath = new Map<string, Set<AbortController>>();
  private audioContext: AudioContext | null = null;
  private eventsComponent: EditorLockEventsComponent | undefined;
  private readonly indicatorsByView = new Map<MarkdownView, LockIndicators>();
  private lastBeepMilliseconds = 0;
  private readonly lockCountByPluginIdByPath = new Map<string, Map<string, number>>();
  private statusBarItemEl: HTMLElement | null = null;

  public isLocked(app: App, pathOrFile: PathOrFile): boolean {
    return this.isPathLocked(getPath(app, pathOrFile));
  }

  public lock(app: App, pathOrFile: PathOrFile, pluginId: string, abortController?: AbortController): Disposable {
    const path = getPath(app, pathOrFile);
    let lockCountByPluginId = this.lockCountByPluginIdByPath.get(path);
    if (!lockCountByPluginId) {
      lockCountByPluginId = new Map<string, number>();
      this.lockCountByPluginIdByPath.set(path, lockCountByPluginId);
    }
    lockCountByPluginId.set(pluginId, (lockCountByPluginId.get(pluginId) ?? 0) + 1);
    if (abortController) {
      let abortControllers = this.abortControllersByPath.get(path);
      if (!abortControllers) {
        abortControllers = new Set<AbortController>();
        this.abortControllersByPath.set(path, abortControllers);
      }
      abortControllers.add(abortController);
    }
    this.ensureSubscribed(app);
    this.reconcile(app);

    return new CallbackDisposable({
      callback: (): void => {
        if (abortController) {
          const abortControllers = this.abortControllersByPath.get(path);
          // The set was created when this lock added its controller and is only removed here.
          // It is therefore always present while this (single-run) disposable callback executes.
          assertNonNullable(abortControllers);
          abortControllers.delete(abortController);
          if (abortControllers.size === 0) {
            this.abortControllersByPath.delete(path);
          }
        }
        this.unlockPath(app, path, pluginId);
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
    const abortControllers = this.abortControllersByPath.get(getPath(app, pathOrFile));
    if (!abortControllers) {
      return;
    }
    for (const controller of abortControllers) {
      controller.abort();
    }
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

  private addUnlockMenuItem(app: App, menu: Menu, path: string): void {
    menu.addItem((item) => {
      item
        .setTitle(t(($) => $.obsidianDevUtils.editorLock.unlockMenuItem))
        .setIcon(UNLOCK_ICON_ID)
        .onClick(convertAsyncToSync(async () => {
          const isConfirmed = await confirm({
            app,
            message: this.unlockConfirmMessage(app, path),
            title: t(($) => $.obsidianDevUtils.editorLock.unlockConfirmTitle)
          });
          if (isConfirmed) {
            this.requestUnlock(app, path);
          }
        }));
    });
  }

  private beep(): void {
    // Throttle so a burst of keystrokes does not stack overlapping tones into a buzz.
    const nowMilliseconds = Date.now();
    if (nowMilliseconds - this.lastBeepMilliseconds < BEEP_THROTTLE_MILLISECONDS) {
      return;
    }
    this.lastBeepMilliseconds = nowMilliseconds;

    // `lib.dom` types `AudioContext` as always present, but it is absent in some runtimes
    // (e.g. the jsdom test environment), so this guard is real, not redundant.
    const AudioContextClass = window.AudioContext;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see the comment above.
    if (!AudioContextClass) {
      return;
    }
    this.audioContext ??= new AudioContextClass();
    const audioContext = this.audioContext;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = BEEP_FREQUENCY_HZ;
    gainNode.gain.value = BEEP_GAIN;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + BEEP_DURATION_SECONDS);
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
      this.beep();
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

  private ensureSubscribed(app: App): void {
    if (this.eventsComponent) {
      return;
    }
    this.eventsComponent = new EditorLockEventsComponent({
      app,
      onChange: (): void => {
        this.reconcile(app);
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

  private handleFileMenu(app: App, menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFile)) {
      return;
    }
    if (!this.isPathLocked(file.path)) {
      return;
    }
    this.addUnlockMenuItem(app, menu, file.path);
  }

  private isPathLocked(path: string): boolean {
    return (this.lockCountByPluginIdByPath.get(path)?.size ?? 0) > 0;
  }

  private lockingPluginNames(app: App, path: string): string[] {
    const lockCountByPluginId = this.lockCountByPluginIdByPath.get(path);
    // `lockingPluginNames` is only ever called for a locked path, so the per-plugin map is always present.
    assertNonNullable(lockCountByPluginId);
    return Array.from(lockCountByPluginId.keys()).map((pluginId) => app.plugins.manifests[pluginId]?.name ?? pluginId);
  }

  private lockTooltip(app: App, path: string): string {
    const header = t(($) => $.obsidianDevUtils.editorLock.lockedByTooltip);
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

      if (this.isPathLocked(path)) {
        viewsToLock.add(view);
        const tooltip = this.lockTooltip(app, path);
        // Re-apply the read-only toggle on every reconcile, not only the first time a view is tracked.
        // The toggle is idempotent, so re-applying to an already-locked view is cheap.
        // A view opened after the lock is reconciled synchronously, before its CodeMirror is ready.
        // Its first toggle is therefore a no-op; re-applying makes the lock take hold once it settles.
        toggleEditorReadOnly(view.editor, true);
        const indicators = this.indicatorsByView.get(view);
        if (indicators) {
          this.updateIndicatorTooltips(indicators, tooltip);
        } else {
          this.indicatorsByView.set(view, this.createIndicators(app, view, path, tooltip));
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
    if (this.lockCountByPluginIdByPath.size === 0) {
      this.eventsComponent?.unload();
      this.eventsComponent = undefined;
    }
  }

  private registerUnlockMenu(app: App, el: HTMLElement, getContextPath: () => string | undefined): void {
    // A plain listener dies with the element when it is `.remove()`d on unlock, so it never leaks.
    el.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      const path = getContextPath();
      if (path === undefined) {
        return;
      }
      const menu = new Menu();
      this.addUnlockMenuItem(app, menu, path);
      menu.showAtMouseEvent(evt);
    });
  }

  private unlockConfirmMessage(app: App, path: string): DocumentFragment {
    const fragment = createFragment();
    fragment.appendText(t(($) => $.obsidianDevUtils.editorLock.unlockConfirmMessage));
    // A runtime-length list of the plugins currently holding a lock, each as a code block on its own line.
    for (const name of this.lockingPluginNames(app, path)) {
      fragment.createEl('br');
      appendCodeBlock(fragment, name);
    }
    return fragment;
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
      // The single status-bar item is reused across active-note switches.
      // It must resolve the currently active note's path at click time rather than capturing one path.
      this.registerUnlockMenu(app, this.statusBarItemEl, () => app.workspace.getActiveViewOfType(MarkdownView)?.file?.path);
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
   * @param options - Optional locking options. Pass an
   * {@link EditorLockComponentLockForPathOptions.abortController} to make the lock cancelable via the
   * indicator's right-click "unlock" menu or {@link requestEditorUnlockForPath}.
   * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
   */
  public lockForPath(pathOrFile: PathOrFile, options?: EditorLockComponentLockForPathOptions): Disposable {
    return getManager().lock(this.app, pathOrFile, this.pluginId, options?.abortController);
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
 * Requests an unlock of the note at the given path by aborting every {@link AbortController} that was
 * associated with a lock on it (via {@link EditorLockComponent.lockForPath}'s
 * {@link EditorLockComponentLockForPathOptions.abortController}). The operations holding the lock
 * observe the abort and release their own locks. A no-op when no abortable lock is registered for the
 * path.
 *
 * This lets a consuming plugin wire its own "unlock active note" command without reaching into the
 * lock manager directly.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to request an unlock for.
 */
export function requestEditorUnlockForPath(app: App, pathOrFile: PathOrFile): void {
  getManager().requestUnlock(app, pathOrFile);
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
