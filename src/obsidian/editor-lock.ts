/**
 * @file
 *
 * Note-scoped, reference-counted editor locking.
 *
 * Where {@link lockEditor} / {@link unlockEditor} from `./editor.ts` toggle the read-only state of a
 * single {@link Editor} instance, the helpers here lock a note by its **path**: while a path is
 * locked, every current and future {@link MarkdownView} of that note (in any window, including
 * popouts) is made read-only and shows a lock icon. Locks are reference-counted, so nested or
 * concurrent operations on the same note are safe — the note is unlocked only when the last lock is
 * released.
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
  EventRef
} from 'obsidian';

import { ViewType } from '@obsidian-typings/obsidian-public-latest/implementations';
import { MarkdownView } from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import {
  CallbackDisposable,
  MultipleDisposeBehavior
} from '../disposable.ts';
import { noop } from '../function.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import {
  lockEditor,
  unlockEditor
} from './editor.ts';
import { getPath } from './file-system.ts';
import { t } from './i18n/i18n.ts';

const EDITOR_LOCK_STATE_KEY = 'editorLock';
const LOCK_ICON_ID = 'lock';

/**
 * Tracks reference-counted, path-scoped editor locks and keeps every open {@link MarkdownView} in
 * sync with the locked-path set. A single instance lives on the shared `obsidian-dev-utils` state.
 */
class EditorPathLockManager {
  private eventRefs: EventRef[] = [];
  private readonly lockCountByPath = new Map<string, number>();
  private readonly lockedIconElByView = new Map<MarkdownView, HTMLElement>();

  public isLocked(app: App, pathOrFile: PathOrFile): boolean {
    return (this.lockCountByPath.get(getPath(app, pathOrFile)) ?? 0) > 0;
  }

  public lock(app: App, pathOrFile: PathOrFile): Disposable {
    const path = getPath(app, pathOrFile);
    this.lockCountByPath.set(path, (this.lockCountByPath.get(path) ?? 0) + 1);
    this.ensureEventsRegistered(app);
    this.reconcile(app);

    return new CallbackDisposable({
      callback: (): void => {
        this.unlockPath(app, path);
      },
      multipleDisposeBehavior: MultipleDisposeBehavior.Ignore
    });
  }

  public unlock(app: App, pathOrFile: PathOrFile): void {
    this.unlockPath(app, getPath(app, pathOrFile));
  }

  private ensureEventsRegistered(app: App): void {
    if (this.eventRefs.length > 0) {
      return;
    }

    const reconcile = (): void => {
      this.reconcile(app);
    };
    this.eventRefs.push(
      app.workspace.on('active-leaf-change', reconcile),
      app.workspace.on('layout-change', reconcile)
    );
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

      if ((this.lockCountByPath.get(path) ?? 0) > 0) {
        viewsToLock.add(view);
        if (!this.lockedIconElByView.has(view)) {
          lockEditor(view.editor);
          const iconEl = view.addAction(LOCK_ICON_ID, t(($) => $.obsidianDevUtils.editorLock.lockedNoteTooltip), noop);
          this.lockedIconElByView.set(view, iconEl);
        }
      }
    }

    for (const [view, iconEl] of this.lockedIconElByView) {
      if (!viewsToLock.has(view)) {
        unlockEditor(view.editor);
        iconEl.remove();
        this.lockedIconElByView.delete(view);
      }
    }
  }

  private unlockPath(app: App, path: string): void {
    const count = this.lockCountByPath.get(path) ?? 0;
    if (count <= 0) {
      return;
    }

    if (count === 1) {
      this.lockCountByPath.delete(path);
    } else {
      this.lockCountByPath.set(path, count - 1);
    }

    this.reconcile(app);

    if (this.lockCountByPath.size === 0) {
      this.unregisterEvents(app);
    }
  }

  private unregisterEvents(app: App): void {
    for (const eventRef of this.eventRefs) {
      app.workspace.offref(eventRef);
    }
    this.eventRefs = [];
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
 * {@link MarkdownView} until the lock is released.
 *
 * The lock is reference-counted: each call must be balanced by exactly one release (either disposing
 * the returned {@link Disposable} — ideally via a `using` declaration — or a matching
 * {@link unlockEditorForPath} call).
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to lock.
 * @returns A {@link Disposable} that releases this lock when disposed. Disposing more than once is a no-op.
 */
export function lockEditorForPath(app: App, pathOrFile: PathOrFile): Disposable {
  return getManager().lock(app, pathOrFile);
}

/**
 * Releases one lock previously acquired for the note at the given path via {@link lockEditorForPath}.
 *
 * When the last lock is released the note becomes fully editable again and its lock icon is removed.
 * Calling this when the note is not locked is a no-op.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file of the note to unlock.
 */
export function unlockEditorForPath(app: App, pathOrFile: PathOrFile): void {
  getManager().unlock(app, pathOrFile);
}

function getManager(): EditorPathLockManager {
  return getObsidianDevUtilsState<EditorPathLockManager>(EDITOR_LOCK_STATE_KEY, new EditorPathLockManager()).value;
}
