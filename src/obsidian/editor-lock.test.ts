// @vitest-environment jsdom

import type {
  App as AppOriginal,
  MarkdownView as MarkdownViewOriginal,
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
import {
  EditorLockComponent,
  isEditorLockedForPath,
  lockEditorForPath,
  requestEditorUnlockForPath,
  unlockEditorForPath
} from './editor-lock.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { confirm } from './modals/confirm.ts';
import { getPluginId } from './plugin/plugin-id.ts';

vi.mock('./editor.ts', () => ({
  toggleEditorReadOnly: vi.fn()
}));

vi.mock('./i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: GenericObject) => unknown) =>
    fn({
      obsidianDevUtils: {
        editorLock: {
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

vi.mock('./plugin/plugin-id.ts', () => ({
  getPluginId: vi.fn(() => 'test-plugin')
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
  vi.mocked(getPluginId).mockReturnValue('test-plugin');
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

describe('lockEditorForPath', () => {
  it('should mark the path as locked', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);
    expect(isEditorLockedForPath(app, 'other.md')).toBe(false);
  });

  it('should lock the editor and add a lock icon for a matching open view', () => {
    const view = createMarkdownView('note.md');
    vi.spyOn(view, 'addAction');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\ntest-plugin', expect.any(Function));
  });

  it('should ignore leaves whose view is not a MarkdownView', () => {
    stubLeaves(leafOf(strictProxy<ViewOriginal>({})));
    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should ignore matching-type views without a file', () => {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
    const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should not lock views whose path differs', () => {
    const view = createMarkdownView('other.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should re-apply the read-only toggle on a subsequent reconcile', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
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

    lockEditorForPath(app, 'note.md');

    expect(onSpy).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('layout-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('file-open', expect.any(Function));
  });

  it('should register workspace events only once across multiple locks', () => {
    stubLeaves();
    const onSpy = vi.spyOn(app.workspace, 'on');

    lockEditorForPath(app, 'note.md');
    lockEditorForPath(app, 'other.md');

    expect(onSpy).toHaveBeenCalledTimes(3);
  });

  it('should lock a view opened after the lock via active-leaf-change', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md');
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

    const disposable = lockEditorForPath(app, 'note.md');
    disposable[Symbol.dispose]();

    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('should not decrement more than once when disposed repeatedly', () => {
    stubLeaves();
    const disposable = lockEditorForPath(app, 'note.md');
    lockEditorForPath(app, 'note.md');

    disposable[Symbol.dispose]();
    disposable[Symbol.dispose]();

    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);
  });
});

describe('unlockEditorForPath', () => {
  it('should unlock views and unregister events when the last lock is released', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    const removeSpy = vi.spyOn(iconEl, 'remove');
    const offrefSpy = vi.spyOn(app.workspace, 'offref');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    unlockEditorForPath(app, 'note.md');

    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(offrefSpy).toHaveBeenCalledTimes(3);
  });

  it('should keep the note locked until every lock is released', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md');
    lockEditorForPath(app, 'note.md');

    unlockEditorForPath(app, 'note.md');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);

    unlockEditorForPath(app, 'note.md');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should be a no-op when the note is not locked', () => {
    const offrefSpy = vi.spyOn(app.workspace, 'offref');
    stubLeaves();

    unlockEditorForPath(app, 'note.md');

    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
    expect(offrefSpy).not.toHaveBeenCalled();
  });

  it('should keep events registered while another path is still locked', () => {
    stubLeaves();
    const offrefSpy = vi.spyOn(app.workspace, 'offref');

    lockEditorForPath(app, 'note.md');
    lockEditorForPath(app, 'other.md');

    unlockEditorForPath(app, 'note.md');
    expect(offrefSpy).not.toHaveBeenCalled();

    unlockEditorForPath(app, 'other.md');
    expect(offrefSpy).toHaveBeenCalledTimes(3);
  });

  it('should keep a note locked until every plugin that locked it releases its lock', () => {
    stubLeaves();

    vi.mocked(getPluginId).mockReturnValue('plugin-a');
    lockEditorForPath(app, 'note.md');
    vi.mocked(getPluginId).mockReturnValue('plugin-b');
    lockEditorForPath(app, 'note.md');

    // The plugin-b lock is released twice; the redundant release hits the per-plugin no-op guard.
    // Plugin-a still holds its lock, so the note stays locked.
    unlockEditorForPath(app, 'note.md');
    unlockEditorForPath(app, 'note.md');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);

    vi.mocked(getPluginId).mockReturnValue('plugin-a');
    unlockEditorForPath(app, 'note.md');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
  });
});

describe('isEditorLockedForPath', () => {
  it('should return false for a never-locked path', () => {
    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
  });
});

describe('lock indicators', () => {
  it('should not add a tab icon when the leaf has no tab status container', () => {
    const view = createMarkdownView('note.md', false);
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
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

    lockEditorForPath(app, 'note.md');

    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\nTest Plugin', expect.any(Function));
  });

  it('should add a status-bar item when the active note is locked and remove it on unlock', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    // A second reconcile must not duplicate the item.
    app.workspace.trigger('layout-change');
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    unlockEditorForPath(app, 'note.md');
    expect(statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });

  it('should not add a status-bar item when the window has no status bar', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');

    expect(view.containerEl.ownerDocument.body.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });
});

describe('EditorLockComponent', () => {
  it('should lock, query, and unlock a note on behalf of its plugin', () => {
    stubLeaves();
    const component = new EditorLockComponent(app);

    component.lockForPath('note.md');
    expect(component.isLockedForPath('note.md')).toBe(true);

    component.unlockForPath('note.md');
    expect(component.isLockedForPath('note.md')).toBe(false);
  });

  it('should release only its own plugin\'s locks when unloaded', () => {
    stubLeaves();

    vi.mocked(getPluginId).mockReturnValue('other-plugin');
    lockEditorForPath(app, 'other-only.md');
    lockEditorForPath(app, 'shared.md');

    vi.mocked(getPluginId).mockReturnValue('test-plugin');
    const component = new EditorLockComponent(app);
    component.load();
    component.lockForPath('shared.md');
    component.lockForPath('own.md');

    component.unload();

    // The other-plugin locks survive (its own note and its share of shared.md); test-plugin's are released.
    expect(isEditorLockedForPath(app, 'other-only.md')).toBe(true);
    expect(isEditorLockedForPath(app, 'shared.md')).toBe(true);
    expect(isEditorLockedForPath(app, 'own.md')).toBe(false);
  });

  it('should pass the abort controller through to the lock', () => {
    stubLeaves();
    const component = new EditorLockComponent(app);
    const abortController = new AbortController();

    component.lockForPath('note.md', { abortController });
    requestEditorUnlockForPath(app, 'note.md');

    expect(abortController.signal.aborted).toBe(true);
  });
});

describe('requestEditorUnlockForPath', () => {
  it('should abort every controller registered for the path', () => {
    stubLeaves();
    const component = new EditorLockComponent(app);
    const firstController = new AbortController();
    const secondController = new AbortController();

    component.lockForPath('note.md', { abortController: firstController });
    component.lockForPath('note.md', { abortController: secondController });
    requestEditorUnlockForPath(app, 'note.md');

    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(true);
  });

  it('should be a no-op when no abortable lock is registered for the path', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md');

    expect(() => {
      requestEditorUnlockForPath(app, 'note.md');
    }).not.toThrow();
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);
  });

  it('should keep the controller of a still-held lock and drop the disposed one', () => {
    stubLeaves();
    const component = new EditorLockComponent(app);
    const disposedController = new AbortController();
    const heldController = new AbortController();

    const disposable = component.lockForPath('note.md', { abortController: disposedController });
    component.lockForPath('note.md', { abortController: heldController });
    disposable[Symbol.dispose]();

    requestEditorUnlockForPath(app, 'note.md');

    expect(disposedController.signal.aborted).toBe(false);
    expect(heldController.signal.aborted).toBe(true);
  });

  it('should drop the controller set entirely when the last abortable lock is disposed', () => {
    stubLeaves();
    const component = new EditorLockComponent(app);
    const abortController = new AbortController();

    const disposable = component.lockForPath('note.md', { abortController });
    disposable[Symbol.dispose]();

    requestEditorUnlockForPath(app, 'note.md');

    expect(abortController.signal.aborted).toBe(false);
  });
});

describe('unlock context menu', () => {
  it('should build an unlock menu item on right-click', () => {
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    new EditorLockComponent(app).lockForPath('note.md', { abortController: new AbortController() });
    dispatchContextMenu(iconEl);

    const menu = getMenu();
    assertNonNullable(menu);
    const item = menu.items__[0];
    assertNonNullable(item);
    expect(item.title__).toBe('Unlock');
    expect(item.icon__).toBe('unlock');
  });

  it('should abort the lock when the unlock is confirmed', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const view = createMarkdownView('note.md');
    const iconEl = createDiv();
    vi.spyOn(view, 'addAction').mockReturnValue(iconEl);
    stubLeaves(leafOf(view));
    const getMenu = captureMenuOnShow();

    const abortController = new AbortController();
    new EditorLockComponent(app).lockForPath('note.md', { abortController });
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
    new EditorLockComponent(app).lockForPath('note.md', { abortController });
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

    new EditorLockComponent(app).lockForPath('note.md', { abortController: new AbortController() });
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

    new EditorLockComponent(app).lockForPath('note.md', { abortController: new AbortController() });
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

    lockEditorForPath(app, 'note.md');
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);

    // The active note is gone by the time the status-bar item is right-clicked.
    setActiveView(null);
    dispatchContextMenu(statusBarItemEl);

    expect(showSpy).not.toHaveBeenCalled();
  });
});
