// @vitest-environment jsdom

import type {
  App as AppOriginal,
  MarkdownView as MarkdownViewOriginal,
  TFile as TFileOriginal,
  View as ViewOriginal,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

import {
  App,
  MarkdownView,
  Menu,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { assertNonNullable } from '../type-guards.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { confirm } from './modals/confirm.ts';
import {
  isResourceLockedForPath,
  lockResourceForPath,
  requestResourceUnlockForPath,
  ResourceLockComponent,
  ResourceLockedError,
  unlockResourceForPath
} from './resource-lock.ts';

vi.mock('./editor.ts', () => ({
  toggleEditorReadOnly: vi.fn()
}));

vi.mock('./i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: GenericObject) => unknown) =>
    fn({
      obsidianDevUtils: {
        resourceLock: {
          lockedByTooltip: 'Locked by',
          lockedNoteTooltip: 'Locked note',
          unlockConfirmMessage: 'Locked by',
          unlockConfirmTitle: 'Unlock note?',
          unlockMenuItem: 'Unlock'
        }
      }
    })
  )
}));

vi.mock('./modals/confirm.ts', () => ({
  confirm: vi.fn()
}));

interface MockAppPlugins {
  plugins: MockPlugins;
}

interface MockLeafTabStatus {
  tabHeaderStatusContainerEl: HTMLElement | null;
}

interface MockManifest {
  name: string;
}

interface MockPlugins {
  manifests: Record<string, MockManifest>;
}

interface MockWorkspaceActiveView {
  getActiveViewOfType(): unknown;
}

let app: AppOriginal;
let mockApp: App;

beforeEach(() => {
  mockApp = App.createConfigured__({
    files: {
      'note.md': '',
      'other.md': ''
    }
  });
  app = mockApp.asOriginalType__();
  vi.clearAllMocks();
  castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => null);
  castTo<MockAppPlugins>(app).plugins = { manifests: {} };
});

afterEach(() => {
  for (const el of Array.from(activeDocument.body.querySelectorAll('.status-bar'))) {
    el.remove();
  }
});

function captureMenuOnShow(): () => Menu | undefined {
  const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');
  // `mock.contexts` records the `this` of each call (the menu instance), typed as `unknown`.
  return () => castTo<Menu | undefined>(showSpy.mock.contexts[0]);
}

function createMarkdownView(path: string, hasTabStatusContainer = true): MarkdownViewOriginal {
  const mockLeaf = WorkspaceLeaf.create2__(mockApp);
  castTo<MockLeafTabStatus>(mockLeaf).tabHeaderStatusContainerEl = hasTabStatusContainer ? createDiv() : null;
  const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
  const file = app.vault.getFileByPath(path);
  assertNonNullable(file);
  view.file = file;
  return view;
}

function dispatchAuxClick(el: EventTarget, button: number): void {
  el.dispatchEvent(new MouseEvent('auxclick', { button, cancelable: true }));
}

function dispatchClick(el: EventTarget): void {
  el.dispatchEvent(new MouseEvent('click', { cancelable: true }));
}

function dispatchContextMenu(el: EventTarget): void {
  el.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true }));
}

async function flushAsync(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function leafOf(view: ViewOriginal): WorkspaceLeafOriginal {
  return strictProxy<WorkspaceLeafOriginal>({ view });
}

function setActiveView(view: MarkdownViewOriginal | null): void {
  castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => view);
}

function stubLeaves(...leaves: WorkspaceLeafOriginal[]): void {
  vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue(leaves);
}

describe('lockResourceForPath', () => {
  it('should mark the path as locked', () => {
    stubLeaves();
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
    expect(isResourceLockedForPath(app, 'other.md')).toBe(false);
  });

  it('should lock the editor and add a lock icon for a matching open view', () => {
    const view = createMarkdownView('note.md');
    vi.spyOn(view, 'addAction');
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\ntest-plugin', expect.any(Function));
  });

  it('should ignore leaves whose view is not a MarkdownView', () => {
    stubLeaves(leafOf(strictProxy<ViewOriginal>({})));
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should ignore matching-type views without a file', () => {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
    const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should not lock views whose path differs', () => {
    const view = createMarkdownView('other.md');
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should re-apply the read-only toggle on a subsequent reconcile', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    app.workspace.trigger('layout-change');

    // The toggle is re-applied on every reconcile (idempotent).
    // A view opened before its editor was ready still becomes read-only once a later reconcile runs.
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenNthCalledWith(1, view.editor, true);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenNthCalledWith(2, view.editor, true);
  });

  it('should register active-leaf-change and layout-change on the first lock', () => {
    stubLeaves();
    const onSpy = vi.spyOn(app.workspace, 'on');

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    expect(onSpy).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('layout-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('file-open', expect.any(Function));
  });

  it('should register workspace events only once across multiple locks', () => {
    stubLeaves();
    const onSpy = vi.spyOn(app.workspace, 'on');

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'other.md', pluginId: 'test-plugin' });

    expect(onSpy).toHaveBeenCalledTimes(4);
  });

  it('should lock a view opened after the lock via active-leaf-change', () => {
    stubLeaves();
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();

    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));
    app.workspace.trigger('active-leaf-change');

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
  });

  it('should return a Disposable that releases the lock on dispose', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    const removeSpy = vi.spyOn(iconEl, 'remove');
    stubLeaves(leafOf(view));

    const disposable = lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    disposable[Symbol.dispose]();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('should not decrement more than once when disposed repeatedly', () => {
    stubLeaves();
    const disposable = lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    disposable[Symbol.dispose]();
    disposable[Symbol.dispose]();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
  });
});

describe('unlockResourceForPath', () => {
  it('should unlock views and unregister events when the last lock is released', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    const removeSpy = vi.spyOn(iconEl, 'remove');
    const offrefSpy = vi.spyOn(app.workspace, 'offref');
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    unlockResourceForPath(app, 'note.md', 'test-plugin');

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(offrefSpy).toHaveBeenCalledTimes(4);
  });

  it('should keep the note locked until every lock is released', () => {
    stubLeaves();
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    unlockResourceForPath(app, 'note.md', 'test-plugin');
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);

    unlockResourceForPath(app, 'note.md', 'test-plugin');
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should be a no-op when the note is not locked', () => {
    const offrefSpy = vi.spyOn(app.workspace, 'offref');
    stubLeaves();

    unlockResourceForPath(app, 'note.md', 'test-plugin');

    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
    expect(offrefSpy).not.toHaveBeenCalled();
  });

  it('should keep events registered while another path is still locked', () => {
    stubLeaves();
    const offrefSpy = vi.spyOn(app.workspace, 'offref');

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'other.md', pluginId: 'test-plugin' });

    unlockResourceForPath(app, 'note.md', 'test-plugin');
    expect(offrefSpy).not.toHaveBeenCalled();

    unlockResourceForPath(app, 'other.md', 'test-plugin');
    expect(offrefSpy).toHaveBeenCalledTimes(4);
  });

  it('should keep a note locked until every plugin that locked it releases its lock', () => {
    stubLeaves();

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'plugin-a' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'plugin-b' });

    // The plugin-b lock is released twice; the redundant release hits the per-plugin no-op guard.
    // Plugin-a still holds its lock, so the note stays locked.
    unlockResourceForPath(app, 'note.md', 'plugin-b');
    unlockResourceForPath(app, 'note.md', 'plugin-b');
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);

    unlockResourceForPath(app, 'note.md', 'plugin-a');
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });
});

describe('isResourceLockedForPath', () => {
  it('should return false for a never-locked path', () => {
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });
});

describe('lock indicators', () => {
  it('should not add a tab icon when the leaf has no tab status container', () => {
    const view = createMarkdownView('note.md', false);
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    // A second reconcile updates tooltips on the existing indicators; with no tab icon it must not throw.
    app.workspace.trigger('layout-change');

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
    expect(view.leaf.tabHeaderStatusContainerEl).toBeNull();
  });

  it('should list the locking plugin name in the tooltip when a manifest is available', () => {
    const view = createMarkdownView('note.md');
    vi.spyOn(view, 'addAction');
    castTo<MockAppPlugins>(app).plugins = { manifests: { 'test-plugin': { name: 'Test Plugin' } } };
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\nTest Plugin', expect.any(Function));
  });

  it('should add a status-bar item when the active note is locked and remove it on unlock', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    // A second reconcile must not duplicate the item.
    app.workspace.trigger('layout-change');
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    unlockResourceForPath(app, 'note.md', 'test-plugin');
    expect(statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });

  it('should not add a status-bar item when the window has no status bar', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    stubLeaves(leafOf(view));

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    expect(view.containerEl.ownerDocument.body.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });
});

describe('ResourceLockComponent', () => {
  it('should lock, query, and unlock a note on behalf of its plugin', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');

    component.lockForPath({ operationName: 'Test operation', pathOrFile: 'note.md' });
    expect(component.isLockedForPath('note.md')).toBe(true);

    component.unlockForPath('note.md');
    expect(component.isLockedForPath('note.md')).toBe(false);
  });

  it('should release only its own plugin\'s locks when unloaded', () => {
    stubLeaves();

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'other-only.md', pluginId: 'other-plugin' });
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'shared.md', pluginId: 'other-plugin' });

    const component = new ResourceLockComponent(app, 'test-plugin');
    component.load();
    component.lockForPath({ operationName: 'Test operation', pathOrFile: 'shared.md' });
    component.lockForPath({ operationName: 'Test operation', pathOrFile: 'own.md' });

    component.unload();

    // The other-plugin locks survive (its own note and its share of shared.md); test-plugin's are released.
    expect(isResourceLockedForPath(app, 'other-only.md')).toBe(true);
    expect(isResourceLockedForPath(app, 'shared.md')).toBe(true);
    expect(isResourceLockedForPath(app, 'own.md')).toBe(false);
  });

  it('should pass the abort controller through to the lock', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();

    component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });
    requestResourceUnlockForPath(app, 'note.md');

    expect(abortController.signal.aborted).toBe(true);
  });
});

describe('requestResourceUnlockForPath', () => {
  it('should abort every controller registered for the path', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const firstController = new AbortController();
    const secondController = new AbortController();

    component.lockForPath({ abortController: firstController, operationName: 'Test operation', pathOrFile: 'note.md' });
    component.lockForPath({ abortController: secondController, operationName: 'Test operation', pathOrFile: 'note.md' });
    requestResourceUnlockForPath(app, 'note.md');

    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(true);
  });

  it('should be a no-op when no abortable lock is registered for the path', () => {
    stubLeaves();
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    expect(() => {
      requestResourceUnlockForPath(app, 'note.md');
    }).not.toThrow();
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
  });

  it('should keep the controller of a still-held lock and drop the disposed one', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const disposedController = new AbortController();
    const heldController = new AbortController();

    const disposable = component.lockForPath({ abortController: disposedController, operationName: 'Test operation', pathOrFile: 'note.md' });
    component.lockForPath({ abortController: heldController, operationName: 'Test operation', pathOrFile: 'note.md' });
    disposable[Symbol.dispose]();

    requestResourceUnlockForPath(app, 'note.md');

    expect(disposedController.signal.aborted).toBe(false);
    expect(heldController.signal.aborted).toBe(true);
  });

  it('should drop the controller set entirely when the last abortable lock is disposed', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();

    const disposable = component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });
    disposable[Symbol.dispose]();

    requestResourceUnlockForPath(app, 'note.md');

    expect(abortController.signal.aborted).toBe(false);
  });
});

describe('requestUnlockForPath (force unlock)', () => {
  it('should abort the controller and release a directly-locked note', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();
    component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });

    component.requestUnlockForPath('note.md');

    expect(abortController.signal.aborted).toBe(true);
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should release a lock that has no abort controller', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });

    component.requestUnlockForPath('note.md');

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should abort and release every plugin\'s lock covering the path', () => {
    stubLeaves();
    const firstController = new AbortController();
    const secondController = new AbortController();
    new ResourceLockComponent(app, 'plugin-a').lockForPath({ abortController: firstController, operationName: 'Op A', pathOrFile: 'note.md' });
    new ResourceLockComponent(app, 'plugin-b').lockForPath({ abortController: secondController, operationName: 'Op B', pathOrFile: 'note.md' });

    new ResourceLockComponent(app, 'test-plugin').requestUnlockForPath('note.md');

    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(true);
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should release both entries even when one is wired to release itself on abort', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const selfReleasingController = new AbortController();
    const plainController = new AbortController();
    // The self-releasing entry removes itself mid-iteration; the snapshot copy ensures the other still aborts.
    component.lockForPath({ abortController: selfReleasingController, operationName: 'Self releasing', pathOrFile: 'note.md', shouldReleaseOnAbort: true });
    component.lockForPath({ abortController: plainController, operationName: 'Plain', pathOrFile: 'note.md' });

    component.requestUnlockForPath('note.md');

    expect(selfReleasingController.signal.aborted).toBe(true);
    expect(plainController.signal.aborted).toBe(true);
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should be a no-op when nothing covers the path', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');

    expect(() => {
      component.requestUnlockForPath('note.md');
    }).not.toThrow();
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });
});

describe('release on abort', () => {
  it('should release the lock and notify when the controller aborts and shouldReleaseOnAbort is set', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();
    const onUnlockRequested = vi.fn();
    component.lockForPath({ abortController, onUnlockRequested, operationName: 'Test operation', pathOrFile: 'note.md', shouldReleaseOnAbort: true });

    abortController.abort();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
    expect(onUnlockRequested).toHaveBeenCalledTimes(1);
  });

  it('should notify without releasing when only onUnlockRequested is set', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();
    const onUnlockRequested = vi.fn();
    component.lockForPath({ abortController, onUnlockRequested, operationName: 'Test operation', pathOrFile: 'note.md' });

    abortController.abort();

    expect(onUnlockRequested).toHaveBeenCalledTimes(1);
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
  });

  it('should release without a callback when only shouldReleaseOnAbort is set', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();
    component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md', shouldReleaseOnAbort: true });

    abortController.abort();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should not release on abort by default', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const abortController = new AbortController();
    component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });

    abortController.abort();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
  });

  it('should not wire a release listener when there is no abort controller', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');

    expect(() => {
      component.lockForPath({ operationName: 'Test operation', pathOrFile: 'note.md', shouldReleaseOnAbort: true });
    }).not.toThrow();
    expect(isResourceLockedForPath(app, 'note.md')).toBe(true);
  });
});

describe('unlock context menu', () => {
  it('should build an unlock menu item on right-click', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
    expect(item.icon__).toBe('unlock');
  });

  it('should build an unlock menu item on left-click', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchClick(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
    expect(item.icon__).toBe('unlock');
  });

  it('should build an unlock menu item on middle-click', () => {
    const MIDDLE_MOUSE_BUTTON = 1;
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchAuxClick(iconEl, MIDDLE_MOUSE_BUTTON);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
  });

  it('should ignore an auxclick from a non-middle button', () => {
    const RIGHT_MOUSE_BUTTON = 2;
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    // The right button's auxclick is handled by the contextmenu listener, so auxclick must ignore it.
    dispatchAuxClick(iconEl, RIGHT_MOUSE_BUTTON);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('should abort and release the lock when the unlock is confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    const abortController = new AbortController();
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    // The unlock menu now releases the lock outright (not only aborts).
    expect(abortController.signal.aborted).toBe(true);
    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should render the plugin name and operation name in the unlock confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    castTo<MockAppPlugins>(app).plugins = { manifests: { 'test-plugin': { name: 'Test Plugin' } } };
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Move selection', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);
    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    const message = vi.mocked(confirm).mock.calls[0]?.[0].message;
    expect(message).toBeInstanceOf(DocumentFragment);
    const fragment = castTo<DocumentFragment>(message);
    expect(fragment.querySelector('code')?.textContent).toBe('Test Plugin');
    expect(fragment.textContent).toContain('Move selection');
  });

  it('should list a repeated plugin+operation lock only once in the confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    castTo<MockAppPlugins>(app).plugins = { manifests: { 'test-plugin': { name: 'Test Plugin' } } };
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    const component = new ResourceLockComponent(app, 'test-plugin');
    // The same plugin locks the same note for the same operation twice; the confirmation lists it once.
    component.lockForPath({ abortController: new AbortController(), operationName: 'Move selection', pathOrFile: 'note.md' });
    component.lockForPath({ abortController: new AbortController(), operationName: 'Move selection', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);
    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    const message = vi.mocked(confirm).mock.calls[0]?.[0].message;
    const fragment = castTo<DocumentFragment>(message);
    expect(fragment.querySelectorAll('code')).toHaveLength(1);
  });

  it('should release a lock that has no abort controller when the unlock is confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    // No abortController: the unlock cannot cancel an operation, but must still release the lock.
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);
    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    expect(isResourceLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should abort the lock when the unlock is confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    const abortController = new AbortController();
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1);
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should not abort the lock when the unlock is canceled', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    const abortController = new AbortController();
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1);
    expect(abortController.signal.aborted).toBe(false);
  });

  it('should wire the unlock menu on the tab icon', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    const tabIconEl = view.leaf.tabHeaderStatusContainerEl?.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(tabIconEl);
    dispatchContextMenu(tabIconEl);

    assertNonNullable(getMenu());
  });

  it('should open the unlock menu from the status-bar item for the active note', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);
    dispatchContextMenu(statusBarItemEl);

    assertNonNullable(getMenu());
  });

  it('should not open a status-bar unlock menu when there is no active note', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));
    const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');

    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'note.md', pluginId: 'test-plugin' });
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);

    // The active note is gone by the time the status-bar item is right-clicked.
    setActiveView(null);
    dispatchContextMenu(statusBarItemEl);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('should render the locking plugin names as code blocks in the unlock confirmation', async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    castTo<MockAppPlugins>(app).plugins = { manifests: { 'test-plugin': { name: 'Test Plugin' } } };
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    dispatchContextMenu(iconEl);
    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    const message = vi.mocked(confirm).mock.calls[0]?.[0].message;
    expect(message).toBeInstanceOf(DocumentFragment);
    expect(castTo<DocumentFragment>(message).querySelector('code')?.textContent).toBe('Test Plugin');
  });
});

describe('unlock file menu', () => {
  it('should add an unlock item to the file menu when the note is locked', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, file, 'tab-header');

    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
    expect(item.icon__).toBe('unlock');
  });

  it('should not add an unlock item to the file menu when the note is not locked', () => {
    const file = app.vault.getFileByPath('note.md');
    assertNonNullable(file);
    // Lock a different note so the events component (and its file-menu handler) is subscribed.
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'other.md' });
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, file, 'tab-header');

    expect(menu.items__).toHaveLength(0);
  });

  it('should not add an unlock item to the file menu for a folder', () => {
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, app.vault.getRoot(), 'file-explorer-context-menu');

    expect(menu.items__).toHaveLength(0);
  });
});

describe('lock type-attempt flash', () => {
  const FLASH_CLASS = 'obsidian-dev-utils-lock-indicator-flash';

  it('should flash the lock indicators when typing is attempted in a locked view', () => {
    const view = createMarkdownView('note.md');
    const actionIconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(actionIconEl);
    stubLeaves(leafOf(view));

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    const tabIconEl = view.leaf.tabHeaderStatusContainerEl?.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(tabIconEl);
    expect(actionIconEl.hasClass(FLASH_CLASS)).toBe(false);

    view.contentEl.dispatchEvent(new Event('beforeinput', { bubbles: true }));

    expect(actionIconEl.hasClass(FLASH_CLASS)).toBe(true);
    expect(tabIconEl.hasClass(FLASH_CLASS)).toBe(true);
  });

  it('should stop flashing after the view is unlocked', () => {
    const view = createMarkdownView('note.md');
    const actionIconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(actionIconEl);
    stubLeaves(leafOf(view));

    const component = new ResourceLockComponent(app, 'test-plugin');
    component.lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
    component.unlockForPath('note.md');

    view.contentEl.dispatchEvent(new Event('beforeinput', { bubbles: true }));

    expect(actionIconEl.hasClass(FLASH_CLASS)).toBe(false);
  });

  it('should beep once (throttled) on repeated type attempts in a locked view', () => {
    const view = createMarkdownView('note.md');
    vi.spyOn(view, 'addAction').mockReturnValue(createDiv());
    stubLeaves(leafOf(view));

    const startMock = vi.fn();
    const createOscillatorMock = vi.fn(() => ({ connect: vi.fn(), frequency: { value: 0 }, start: startMock, stop: vi.fn(), type: '' }));
    const fakeAudioContext = { createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 0 } })), createOscillator: createOscillatorMock, currentTime: 0, destination: {} };
    const originalAudioContext = window.AudioContext;
    // eslint-disable-next-line prefer-arrow-callback -- vitest needs a real function (not an arrow) to construct via `new`.
    window.AudioContext = castTo<typeof AudioContext>(vi.fn(function fakeAudioContextCtor() {
      return fakeAudioContext;
    }));

    try {
      new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), operationName: 'Test operation', pathOrFile: 'note.md' });
      view.contentEl.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      view.contentEl.dispatchEvent(new Event('beforeinput', { bubbles: true }));
    } finally {
      window.AudioContext = originalAudioContext;
    }

    expect(createOscillatorMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
});

describe('subtree locking', () => {
  beforeEach(() => {
    mockApp = App.createConfigured__({
      files: {
        'folder/a.md': '',
        'folder/sub/b.md': '',
        'outside.md': ''
      }
    });
    app = mockApp.asOriginalType__();
    castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => null);
    castTo<MockAppPlugins>(app).plugins = { manifests: {} };
  });

  it('should report a path under a subtree-locked folder as locked by ancestor', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(false);

    component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    expect(component.isLockedByAncestorForPath('folder')).toBe(true);
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(true);
    expect(component.isLockedByAncestorForPath('folder/sub/b.md')).toBe(true);
    expect(component.isLockedByAncestorForPath('outside.md')).toBe(false);
    // A descendant is covered by ancestor but is not itself directly locked.
    expect(component.isLockedForPath('folder/a.md')).toBe(false);
    expect(component.isLockedForPath('folder')).toBe(true);
  });

  it('should make a note inside a subtree-locked folder read-only', () => {
    const view = createMarkdownView('folder/a.md');
    stubLeaves(leafOf(view));

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
  });

  it('should force-unlock a note under a subtree-locked folder via requestUnlockForPath', () => {
    stubLeaves();
    const abortController = new AbortController();
    const component = new ResourceLockComponent(app, 'test-plugin');
    component.lockForPath({ abortController, mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    // Resolves the covering subtree owner (`folder`), aborts it, and releases it.
    component.requestUnlockForPath('folder/a.md');

    expect(abortController.signal.aborted).toBe(true);
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should resolve a descendant to the innermost (deepest) subtree lock', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    stubLeaves();
    const outerController = new AbortController();
    const innerController = new AbortController();
    // Lock the outer folder first so the inner (longer) path must replace it as the resolved owner.
    new ResourceLockComponent(app, 'outer-plugin').lockForPath({ abortController: outerController, mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    new ResourceLockComponent(app, 'inner-plugin').lockForPath({ abortController: innerController, mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder/sub' });

    const file = app.vault.getFileByPath('folder/sub/b.md');
    assertNonNullable(file);
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, file, 'tab-header');
    const item = menu.items__[0];
    assertNonNullable(item);
    item.onClick__?.(new MouseEvent('click'));
    await flushAsync();

    // The unlock targets the innermost owner, so only the inner lock's controller is aborted.
    expect(innerController.signal.aborted).toBe(true);
    expect(outerController.signal.aborted).toBe(false);
  });

  it('should keep the subtree lock until every acquisition is released', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    const first = component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    const second = component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    first[Symbol.dispose]();
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(true);

    second[Symbol.dispose]();
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should release subtree locks when the plugin unloads', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    component.load();
    component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    component.unload();

    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should keep another plugin\'s file lock when a plugin with only a subtree lock unloads', () => {
    stubLeaves();
    lockResourceForPath({ app, operationName: 'Test operation', pathOrFile: 'outside.md', pluginId: 'file-plugin' });
    const component = new ResourceLockComponent(app, 'subtree-plugin');
    component.load();
    component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    // Unloading the subtree plugin must not touch the unrelated file lock held by file-plugin.
    component.unload();

    expect(isResourceLockedForPath(app, 'outside.md')).toBe(true);
    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should keep a co-held subtree lock and ignore a late dispose after one holder unloads', () => {
    stubLeaves();
    const componentA = new ResourceLockComponent(app, 'plugin-a');
    const componentB = new ResourceLockComponent(app, 'plugin-b');
    componentA.load();
    componentB.load();
    const disposableA = componentA.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    componentB.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    // Unloading A removes A but leaves B's subtree lock on the same folder (map not empty).
    componentA.unload();
    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);

    // A's outstanding handle disposes after A was already cleared — a safe no-op that leaves B intact.
    disposableA[Symbol.dispose]();
    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);

    componentB.unload();
    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should ignore the subtree-cleanup pass for a plugin that holds no subtree lock', () => {
    stubLeaves();
    const subtreeComponent = new ResourceLockComponent(app, 'subtree-plugin');
    subtreeComponent.load();
    subtreeComponent.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });

    const fileComponent = new ResourceLockComponent(app, 'file-plugin');
    fileComponent.load();
    fileComponent.lockForPath({ operationName: 'Test operation', pathOrFile: 'outside.md' });

    // File-plugin holds no subtree lock, so its unload's subtree-cleanup pass finds nothing to delete.
    fileComponent.unload();

    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);
  });

  it('should not open a status-bar menu when the active note is no longer locked at click time', () => {
    const lockedView = createMarkdownView('folder/a.md');
    const unlockedView = createMarkdownView('outside.md');
    setActiveView(lockedView);
    const statusBarEl = lockedView.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(lockedView));
    const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);

    // The active note switches to an unlocked one before the right-click, so no owner resolves.
    setActiveView(unlockedView);
    dispatchContextMenu(statusBarItemEl);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('should be a safe no-op to dispose a subtree lock after the plugin unloaded', () => {
    stubLeaves();
    const component = new ResourceLockComponent(app, 'test-plugin');
    component.load();
    const disposable = component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    component.unload();

    expect(() => {
      disposable[Symbol.dispose]();
    }).not.toThrow();
    expect(new ResourceLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should add an unlock item to the file menu for a subtree-locked folder', () => {
    stubLeaves();
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    const folder = app.vault.getAbstractFileByPath('folder');
    assertNonNullable(folder);
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, folder, 'file-explorer-context-menu');

    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
  });

  it('should add an unlock item to the file menu for a note under a subtree-locked folder', () => {
    stubLeaves();
    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    const file = app.vault.getFileByPath('folder/a.md');
    assertNonNullable(file);
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, file, 'tab-header');

    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
  });

  it('should show and wire the status-bar item for an active note under a subtree lock', () => {
    const view = createMarkdownView('folder/a.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController: new AbortController(), mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder' });
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);
    dispatchContextMenu(statusBarItemEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
  });
});

describe('ResourceLockedError', () => {
  it('should carry the blocked path in its message and name', () => {
    const error = new ResourceLockedError('folder/note.md');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ResourceLockedError');
    expect(error.path).toBe('folder/note.md');
    expect(error.message).toContain('folder/note.md');
  });
});

describe('mutation blocker', () => {
  beforeEach(() => {
    mockApp = App.createConfigured__({
      files: {
        'other.md': '',
        'source.md': 'src',
        'target.md': 'content'
      }
    });
    app = mockApp.asOriginalType__();
    castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => null);
    castTo<MockAppPlugins>(app).plugins = { manifests: {} };
    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
  });

  function lockTarget(): Disposable {
    return new ResourceLockComponent(app, 'blocker-plugin').lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
  }

  function targetFile(): TFileOriginal {
    const file = app.vault.getFileByPath('target.md');
    assertNonNullable(file);
    return file;
  }

  it('should not block mutations for a read-only (non-blocking) lock', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md' });
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(false);
  });

  it('should block mutations only while a blocking lock is held', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    const disposable = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(true);
    expect(component.isMutationBlockedByAncestorForPath('other.md')).toBe(false);

    disposable[Symbol.dispose]();
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(false);
  });

  it('should block a mutation under a subtree blocking lock', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder', shouldBlockMutations: true });
    expect(component.isMutationBlockedByAncestorForPath('folder/child.md')).toBe(true);
    expect(component.isMutationBlockedByAncestorForPath('elsewhere.md')).toBe(false);
  });

  it('should stop blocking (uninstall the patch) once the lock is released', async () => {
    const disposable = lockTarget();
    const file = targetFile();
    expect(() => app.vault.rename(file, 'renamed.md')).toThrow(ResourceLockedError);

    disposable[Symbol.dispose]();
    // The patch is uninstalled, so the same rename now runs.
    await expect(app.vault.rename(file, 'renamed.md')).resolves.toBeUndefined();
  });

  it('should allow a mutation of an unblocked path while a blocking lock is held', async () => {
    using _lock = lockTarget();
    await expect(app.vault.create('allowed.md', 'x')).resolves.toBeDefined();
  });

  it('should block vault.append of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.vault.append(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should block vault.copy to a locked destination', () => {
    using _lock = lockTarget();
    const source = app.vault.getFileByPath('source.md');
    assertNonNullable(source);
    expect(() => app.vault.copy(source, 'target.md')).toThrow(ResourceLockedError);
  });

  it('should block vault.create at a locked path', () => {
    using _lock = lockTarget();
    expect(() => app.vault.create('target.md', 'x')).toThrow(ResourceLockedError);
  });

  it('should block vault.createBinary at a locked path', () => {
    using _lock = lockTarget();
    expect(() => app.vault.createBinary('target.md', new ArrayBuffer(0))).toThrow(ResourceLockedError);
  });

  it('should block vault.createFolder at a locked path', () => {
    using _lock = lockTarget();
    expect(() => app.vault.createFolder('target.md')).toThrow(ResourceLockedError);
  });

  it('should block vault.delete of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Exercising the mutation blocker on this method.
    expect(() => app.vault.delete(file)).toThrow(ResourceLockedError);
  });

  it('should block vault.modify of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.vault.modify(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should block vault.modifyBinary of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.vault.modifyBinary(file, new ArrayBuffer(0))).toThrow(ResourceLockedError);
  });

  it('should block vault.process of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.vault.process(file, (content) => content)).toThrow(ResourceLockedError);
  });

  it('should block vault.rename of a locked file (source)', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.vault.rename(file, 'renamed.md')).toThrow(ResourceLockedError);
  });

  it('should block a rename whose destination is locked', () => {
    using _lock = lockTarget();
    const source = app.vault.getFileByPath('source.md');
    assertNonNullable(source);
    expect(() => app.vault.rename(source, 'target.md')).toThrow(ResourceLockedError);
  });

  it('should block vault.trash of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Exercising the mutation blocker on this method.
    expect(() => app.vault.trash(file, false)).toThrow(ResourceLockedError);
  });

  it('should block fileManager.renameFile of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.fileManager.renameFile(file, 'renamed.md')).toThrow(ResourceLockedError);
  });

  it('should block fileManager.trashFile of a locked file', () => {
    using _lock = lockTarget();
    const file = targetFile();
    expect(() => app.fileManager.trashFile(file)).toThrow(ResourceLockedError);
  });

  it('should keep the blocker installed until the last blocking lock on the path is released', async () => {
    const first = lockTarget();
    // The second blocking lock reuses the already-installed patch (no re-install).
    const second = lockTarget();
    const file = targetFile();
    // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Exercising the mutation blocker on this method.
    expect(() => app.vault.delete(file)).toThrow(ResourceLockedError);

    // Releasing one of the two blocking locks keeps the path blocked (the other still holds it).
    first[Symbol.dispose]();
    // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Exercising the mutation blocker on this method.
    expect(() => app.vault.delete(file)).toThrow(ResourceLockedError);

    // Releasing the last blocking lock uninstalls the patch, so the mutation runs.
    second[Symbol.dispose]();
    // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Confirming the mutation runs once the blocker is uninstalled.
    await expect(app.vault.delete(file)).resolves.toBeUndefined();
  });
});

describe('mutation bypass scope', () => {
  beforeEach(() => {
    mockApp = App.createConfigured__({
      files: {
        'folder/child.md': 'child',
        'other.md': '',
        'source.md': 'src',
        'target.md': 'content'
      }
    });
    app = mockApp.asOriginalType__();
    castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => null);
    castTo<MockAppPlugins>(app).plugins = { manifests: {} };
    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
  });

  function fileAt(path: string): TFileOriginal {
    const file = app.vault.getFileByPath(path);
    assertNonNullable(file);
    return file;
  }

  it('should allow a mutation of a bypassed blocked path', async () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _bypass = component.bypassBlockedMutations(['target.md']);

    await expect(app.vault.modify(fileAt('target.md'), 'new content')).resolves.toBeUndefined();
    expect(await app.vault.read(fileAt('target.md'))).toBe('new content');
  });

  it('should keep blocking a path not covered by the active bypass scope', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lockTarget = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _lockSource = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'source.md', shouldBlockMutations: true });
    using _bypass = component.bypassBlockedMutations(['target.md']);

    // Target.md is bypassed; source.md is still enforced.
    const source = fileAt('source.md');
    expect(() => app.vault.modify(source, 'x')).toThrow(ResourceLockedError);
  });

  it('should enforce the path again once the bypass scope ends', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    const bypass = component.bypassBlockedMutations(['target.md']);
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(true);
    bypass[Symbol.dispose]();

    const file = fileAt('target.md');
    expect(() => app.vault.modify(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should let a folder bypass cover its whole subtree', async () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder', shouldBlockMutations: true });
    using _bypass = component.bypassBlockedMutations(['folder']);

    await expect(app.vault.modify(fileAt('folder/child.md'), 'new child')).resolves.toBeUndefined();
  });

  it('should not allow a path outside every bypass scope', () => {
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _bypassOther = component.bypassBlockedMutations(['other.md']);

    const file = fileAt('target.md');
    expect(() => app.vault.modify(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should be safe to dispose a bypass scope twice', () => {
    const bypass = new ResourceLockComponent(app, 'test-plugin').bypassBlockedMutations(['target.md']);
    bypass[Symbol.dispose]();
    expect(() => {
      bypass[Symbol.dispose]();
    }).not.toThrow();
  });
});

describe('external-change detection', () => {
  beforeEach(() => {
    mockApp = App.createConfigured__({
      files: {
        'folder/child.md': 'child',
        'other.md': '',
        'source.md': 'src',
        'target.md': 'content'
      }
    });
    app = mockApp.asOriginalType__();
    castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => null);
    castTo<MockAppPlugins>(app).plugins = { manifests: {} };
    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
  });

  function fileAt(path: string): TFileOriginal {
    const file = app.vault.getFileByPath(path);
    assertNonNullable(file);
    return file;
  }

  it('should abort the owning lock when an external delete hits a mutation-blocked path', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    app.vault.trigger('delete', fileAt('target.md'));
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should abort on an external create landing on a blocked path', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    app.vault.trigger('create', fileAt('target.md'));
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should abort when a rename touches a blocked path', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    // The file is now at target.md (a blocked path), renamed from an unblocked old path.
    app.vault.trigger('rename', fileAt('target.md'), 'was.md');
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should abort on a metadataCache deleted event for a blocked path', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    app.metadataCache.trigger('deleted', fileAt('target.md'), null);
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should abort the folder lock when a child under a blocking subtree lock changes externally', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, mode: 'subtree', operationName: 'Test operation', pathOrFile: 'folder', shouldBlockMutations: true });

    app.vault.trigger('delete', fileAt('folder/child.md'));
    expect(abortController.signal.aborted).toBe(true);
  });

  it('should not abort for a change covered by an active bypass scope', () => {
    const abortController = new AbortController();
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _bypass = component.bypassBlockedMutations(['target.md']);

    app.vault.trigger('delete', fileAt('target.md'));
    expect(abortController.signal.aborted).toBe(false);
  });

  it('should ignore an external change on a path that is not mutation-blocked', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    app.vault.trigger('delete', fileAt('other.md'));
    expect(abortController.signal.aborted).toBe(false);
  });

  it('should ignore an external change while only a read-only (non-blocking) lock covers the path', () => {
    const abortController = new AbortController();
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ abortController, operationName: 'Test operation', pathOrFile: 'target.md' });

    app.vault.trigger('delete', fileAt('target.md'));
    expect(abortController.signal.aborted).toBe(false);
  });

  it('should only abort the blocking locks that cover the changed path', () => {
    const targetController = new AbortController();
    const sourceController = new AbortController();
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _lockTarget = component.lockForPath({ abortController: targetController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _lockSource = component.lockForPath({ abortController: sourceController, operationName: 'Test operation', pathOrFile: 'source.md', shouldBlockMutations: true });

    app.vault.trigger('delete', fileAt('target.md'));
    expect(targetController.signal.aborted).toBe(true);
    expect(sourceController.signal.aborted).toBe(false);
  });

  it('should skip a non-blocking lock entry when aborting the covering blocking lock', () => {
    const blockingController = new AbortController();
    const readOnlyController = new AbortController();
    const component = new ResourceLockComponent(app, 'test-plugin');
    using _blocking = component.lockForPath({ abortController: blockingController, operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });
    using _readOnly = component.lockForPath({ abortController: readOnlyController, operationName: 'Test operation', pathOrFile: 'other.md' });

    app.vault.trigger('delete', fileAt('target.md'));
    expect(blockingController.signal.aborted).toBe(true);
    expect(readOnlyController.signal.aborted).toBe(false);
  });

  it('should not throw when a covering blocking lock has no abort controller', () => {
    using _lock = new ResourceLockComponent(app, 'test-plugin').lockForPath({ operationName: 'Test operation', pathOrFile: 'target.md', shouldBlockMutations: true });

    expect(() => {
      app.vault.trigger('delete', fileAt('target.md'));
    }).not.toThrow();
  });
});
