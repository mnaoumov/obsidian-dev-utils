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
import {
  EditorLockComponent,
  isEditorLockedForPath,
  lockEditorForPath,
  requestEditorUnlockForPath,
  ResourceLockedError,
  unlockEditorForPath
} from './editor-lock.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { confirm } from './modals/confirm.ts';

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
    lockEditorForPath(app, 'note.md', 'test-plugin');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);
    expect(isEditorLockedForPath(app, 'other.md')).toBe(false);
  });

  it('should lock the editor and add a lock icon for a matching open view', () => {
    const view = createMarkdownView('note.md');
    vi.spyOn(view, 'addAction');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\ntest-plugin', expect.any(Function));
  });

  it('should ignore leaves whose view is not a MarkdownView', () => {
    stubLeaves(leafOf(strictProxy<ViewOriginal>({})));
    lockEditorForPath(app, 'note.md', 'test-plugin');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should ignore matching-type views without a file', () => {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
    const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should not lock views whose path differs', () => {
    const view = createMarkdownView('other.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');
    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
  });

  it('should re-apply the read-only toggle on a subsequent reconcile', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');
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

    lockEditorForPath(app, 'note.md', 'test-plugin');

    expect(onSpy).toHaveBeenCalledWith('active-leaf-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('layout-change', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('file-open', expect.any(Function));
  });

  it('should register workspace events only once across multiple locks', () => {
    stubLeaves();
    const onSpy = vi.spyOn(app.workspace, 'on');

    lockEditorForPath(app, 'note.md', 'test-plugin');
    lockEditorForPath(app, 'other.md', 'test-plugin');

    expect(onSpy).toHaveBeenCalledTimes(4);
  });

  it('should lock a view opened after the lock via active-leaf-change', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md', 'test-plugin');
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

    const disposable = lockEditorForPath(app, 'note.md', 'test-plugin');
    disposable[Symbol.dispose]();

    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('should not decrement more than once when disposed repeatedly', () => {
    stubLeaves();
    const disposable = lockEditorForPath(app, 'note.md', 'test-plugin');
    lockEditorForPath(app, 'note.md', 'test-plugin');

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

    lockEditorForPath(app, 'note.md', 'test-plugin');
    unlockEditorForPath(app, 'note.md', 'test-plugin');

    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, false);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(offrefSpy).toHaveBeenCalledTimes(4);
  });

  it('should keep the note locked until every lock is released', () => {
    stubLeaves();
    lockEditorForPath(app, 'note.md', 'test-plugin');
    lockEditorForPath(app, 'note.md', 'test-plugin');

    unlockEditorForPath(app, 'note.md', 'test-plugin');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);

    unlockEditorForPath(app, 'note.md', 'test-plugin');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(false);
  });

  it('should be a no-op when the note is not locked', () => {
    const offrefSpy = vi.spyOn(app.workspace, 'offref');
    stubLeaves();

    unlockEditorForPath(app, 'note.md', 'test-plugin');

    expect(vi.mocked(toggleEditorReadOnly)).not.toHaveBeenCalled();
    expect(offrefSpy).not.toHaveBeenCalled();
  });

  it('should keep events registered while another path is still locked', () => {
    stubLeaves();
    const offrefSpy = vi.spyOn(app.workspace, 'offref');

    lockEditorForPath(app, 'note.md', 'test-plugin');
    lockEditorForPath(app, 'other.md', 'test-plugin');

    unlockEditorForPath(app, 'note.md', 'test-plugin');
    expect(offrefSpy).not.toHaveBeenCalled();

    unlockEditorForPath(app, 'other.md', 'test-plugin');
    expect(offrefSpy).toHaveBeenCalledTimes(4);
  });

  it('should keep a note locked until every plugin that locked it releases its lock', () => {
    stubLeaves();

    lockEditorForPath(app, 'note.md', 'plugin-a');
    lockEditorForPath(app, 'note.md', 'plugin-b');

    // The plugin-b lock is released twice; the redundant release hits the per-plugin no-op guard.
    // Plugin-a still holds its lock, so the note stays locked.
    unlockEditorForPath(app, 'note.md', 'plugin-b');
    unlockEditorForPath(app, 'note.md', 'plugin-b');
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);

    unlockEditorForPath(app, 'note.md', 'plugin-a');
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

    lockEditorForPath(app, 'note.md', 'test-plugin');
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

    lockEditorForPath(app, 'note.md', 'test-plugin');

    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'Locked by\nTest Plugin', expect.any(Function));
  });

  it('should add a status-bar item when the active note is locked and remove it on unlock', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    const statusBarEl = view.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    // A second reconcile must not duplicate the item.
    app.workspace.trigger('layout-change');
    expect(statusBarEl.querySelectorAll('.obsidian-dev-utils-lock-indicator')).toHaveLength(1);

    unlockEditorForPath(app, 'note.md', 'test-plugin');
    expect(statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });

  it('should not add a status-bar item when the window has no status bar', () => {
    const view = createMarkdownView('note.md');
    setActiveView(view);
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md', 'test-plugin');

    expect(view.containerEl.ownerDocument.body.querySelector('.obsidian-dev-utils-lock-indicator')).toBeNull();
  });
});

describe('EditorLockComponent', () => {
  it('should lock, query, and unlock a note on behalf of its plugin', () => {
    stubLeaves();
    const component = new EditorLockComponent(app, 'test-plugin');

    component.lockForPath('note.md');
    expect(component.isLockedForPath('note.md')).toBe(true);

    component.unlockForPath('note.md');
    expect(component.isLockedForPath('note.md')).toBe(false);
  });

  it('should release only its own plugin\'s locks when unloaded', () => {
    stubLeaves();

    lockEditorForPath(app, 'other-only.md', 'other-plugin');
    lockEditorForPath(app, 'shared.md', 'other-plugin');

    const component = new EditorLockComponent(app, 'test-plugin');
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
    const component = new EditorLockComponent(app, 'test-plugin');
    const abortController = new AbortController();

    component.lockForPath('note.md', { abortController });
    requestEditorUnlockForPath(app, 'note.md');

    expect(abortController.signal.aborted).toBe(true);
  });
});

describe('requestEditorUnlockForPath', () => {
  it('should abort every controller registered for the path', () => {
    stubLeaves();
    const component = new EditorLockComponent(app, 'test-plugin');
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
    lockEditorForPath(app, 'note.md', 'test-plugin');

    expect(() => {
      requestEditorUnlockForPath(app, 'note.md');
    }).not.toThrow();
    expect(isEditorLockedForPath(app, 'note.md')).toBe(true);
  });

  it('should keep the controller of a still-held lock and drop the disposed one', () => {
    stubLeaves();
    const component = new EditorLockComponent(app, 'test-plugin');
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
    const component = new EditorLockComponent(app, 'test-plugin');
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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
    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController });
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
    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController });
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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

    lockEditorForPath(app, 'note.md', 'test-plugin');
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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
    new EditorLockComponent(app, 'test-plugin').lockForPath('other.md', { abortController: new AbortController() });
    const menu = Menu.create2__();
    app.workspace.trigger('file-menu', menu, file, 'tab-header');

    expect(menu.items__).toHaveLength(0);
  });

  it('should not add an unlock item to the file menu for a folder', () => {
    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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

    const component = new EditorLockComponent(app, 'test-plugin');
    component.lockForPath('note.md', { abortController: new AbortController() });
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
      new EditorLockComponent(app, 'test-plugin').lockForPath('note.md', { abortController: new AbortController() });
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
    const component = new EditorLockComponent(app, 'test-plugin');
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(false);

    component.lockForPath('folder', { mode: 'subtree' });

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

    new EditorLockComponent(app, 'test-plugin').lockForPath('folder', { mode: 'subtree' });

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledWith(view.editor, true);
  });

  it('should resolve a descendant to the innermost (deepest) subtree lock', async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    stubLeaves();
    const outerController = new AbortController();
    const innerController = new AbortController();
    // Lock the outer folder first so the inner (longer) path must replace it as the resolved owner.
    new EditorLockComponent(app, 'outer-plugin').lockForPath('folder', { abortController: outerController, mode: 'subtree' });
    new EditorLockComponent(app, 'inner-plugin').lockForPath('folder/sub', { abortController: innerController, mode: 'subtree' });

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
    const component = new EditorLockComponent(app, 'test-plugin');
    const first = component.lockForPath('folder', { mode: 'subtree' });
    const second = component.lockForPath('folder', { mode: 'subtree' });

    first[Symbol.dispose]();
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(true);

    second[Symbol.dispose]();
    expect(component.isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should release subtree locks when the plugin unloads', () => {
    stubLeaves();
    const component = new EditorLockComponent(app, 'test-plugin');
    component.load();
    component.lockForPath('folder', { mode: 'subtree' });

    component.unload();

    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should keep another plugin\'s file lock when a plugin with only a subtree lock unloads', () => {
    stubLeaves();
    lockEditorForPath(app, 'outside.md', 'file-plugin');
    const component = new EditorLockComponent(app, 'subtree-plugin');
    component.load();
    component.lockForPath('folder', { mode: 'subtree' });

    // Unloading the subtree plugin must not touch the unrelated file lock held by file-plugin.
    component.unload();

    expect(isEditorLockedForPath(app, 'outside.md')).toBe(true);
    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should keep a co-held subtree lock and ignore a late dispose after one holder unloads', () => {
    stubLeaves();
    const componentA = new EditorLockComponent(app, 'plugin-a');
    const componentB = new EditorLockComponent(app, 'plugin-b');
    componentA.load();
    componentB.load();
    const disposableA = componentA.lockForPath('folder', { mode: 'subtree' });
    componentB.lockForPath('folder', { mode: 'subtree' });

    // Unloading A removes A but leaves B's subtree lock on the same folder (map not empty).
    componentA.unload();
    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);

    // A's outstanding handle disposes after A was already cleared — a safe no-op that leaves B intact.
    disposableA[Symbol.dispose]();
    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);

    componentB.unload();
    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should ignore the subtree-cleanup pass for a plugin that holds no subtree lock', () => {
    stubLeaves();
    const subtreeComponent = new EditorLockComponent(app, 'subtree-plugin');
    subtreeComponent.load();
    subtreeComponent.lockForPath('folder', { mode: 'subtree' });

    const fileComponent = new EditorLockComponent(app, 'file-plugin');
    fileComponent.load();
    fileComponent.lockForPath('outside.md');

    // File-plugin holds no subtree lock, so its unload's subtree-cleanup pass finds nothing to delete.
    fileComponent.unload();

    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(true);
  });

  it('should not open a status-bar menu when the active note is no longer locked at click time', () => {
    const lockedView = createMarkdownView('folder/a.md');
    const unlockedView = createMarkdownView('outside.md');
    setActiveView(lockedView);
    const statusBarEl = lockedView.containerEl.ownerDocument.body.createDiv({ cls: 'status-bar' });
    stubLeaves(leafOf(lockedView));
    const showSpy = vi.spyOn(Menu.prototype, 'showAtMouseEvent');

    new EditorLockComponent(app, 'test-plugin').lockForPath('folder', { abortController: new AbortController(), mode: 'subtree' });
    const statusBarItemEl = statusBarEl.querySelector('.obsidian-dev-utils-lock-indicator');
    assertNonNullable(statusBarItemEl);

    // The active note switches to an unlocked one before the right-click, so no owner resolves.
    setActiveView(unlockedView);
    dispatchContextMenu(statusBarItemEl);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('should be a safe no-op to dispose a subtree lock after the plugin unloaded', () => {
    stubLeaves();
    const component = new EditorLockComponent(app, 'test-plugin');
    component.load();
    const disposable = component.lockForPath('folder', { mode: 'subtree' });
    component.unload();

    expect(() => {
      disposable[Symbol.dispose]();
    }).not.toThrow();
    expect(new EditorLockComponent(app, 'other').isLockedByAncestorForPath('folder/a.md')).toBe(false);
  });

  it('should add an unlock item to the file menu for a subtree-locked folder', () => {
    stubLeaves();
    new EditorLockComponent(app, 'test-plugin').lockForPath('folder', { abortController: new AbortController(), mode: 'subtree' });
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
    new EditorLockComponent(app, 'test-plugin').lockForPath('folder', { abortController: new AbortController(), mode: 'subtree' });
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

    new EditorLockComponent(app, 'test-plugin').lockForPath('folder', { abortController: new AbortController(), mode: 'subtree' });
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
    return new EditorLockComponent(app, 'blocker-plugin').lockForPath('target.md', { shouldBlockMutations: true });
  }

  function targetFile(): TFileOriginal {
    const file = app.vault.getFileByPath('target.md');
    assertNonNullable(file);
    return file;
  }

  it('should not block mutations for a read-only (non-blocking) lock', () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md');
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(false);
  });

  it('should block mutations only while a blocking lock is held', () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    const disposable = component.lockForPath('target.md', { shouldBlockMutations: true });
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(true);
    expect(component.isMutationBlockedByAncestorForPath('other.md')).toBe(false);

    disposable[Symbol.dispose]();
    expect(component.isMutationBlockedByAncestorForPath('target.md')).toBe(false);
  });

  it('should block a mutation under a subtree blocking lock', () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('folder', { mode: 'subtree', shouldBlockMutations: true });
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

describe('owner session (mutation arming)', () => {
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

  function targetFile(): TFileOriginal {
    const file = app.vault.getFileByPath('target.md');
    assertNonNullable(file);
    return file;
  }

  it('should allow an armed mutation of a blocked path', async () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md', { shouldBlockMutations: true });
    using session = component.createOwnerSession();

    session.armExpectedMutation(['target.md']);
    await expect(app.vault.modify(targetFile(), 'new content')).resolves.toBeUndefined();
    expect(await app.vault.read(targetFile())).toBe('new content');
  });

  it('should still block an unarmed mutation while a session is open', () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md', { shouldBlockMutations: true });
    using _session = component.createOwnerSession();

    const file = targetFile();
    expect(() => app.vault.modify(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should consume an arm one-shot, blocking a second identical mutation', async () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md', { shouldBlockMutations: true });
    using session = component.createOwnerSession();

    session.armExpectedMutation(['target.md']);
    await app.vault.modify(targetFile(), 'first');
    const file = targetFile();
    expect(() => app.vault.modify(file, 'second')).toThrow(ResourceLockedError);
  });

  it('should allow exactly as many mutations as arms', async () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md', { shouldBlockMutations: true });
    using session = component.createOwnerSession();

    session.armExpectedMutation(['target.md']);
    session.armExpectedMutation(['target.md']);
    await app.vault.modify(targetFile(), 'a');
    await app.vault.modify(targetFile(), 'b');
    const file = targetFile();
    expect(() => app.vault.modify(file, 'c')).toThrow(ResourceLockedError);
  });

  it('should arm both source and destination for a rename', async () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lockSource = component.lockForPath('target.md', { shouldBlockMutations: true });
    using _lockDest = component.lockForPath('renamed.md', { shouldBlockMutations: true });
    using session = component.createOwnerSession();

    session.armExpectedMutation(['target.md', 'renamed.md']);
    await expect(app.vault.rename(targetFile(), 'renamed.md')).resolves.toBeUndefined();
  });

  it('should drop unconsumed arms when the session is disposed', () => {
    const component = new EditorLockComponent(app, 'test-plugin');
    using _lock = component.lockForPath('target.md', { shouldBlockMutations: true });
    const session = component.createOwnerSession();
    session.armExpectedMutation(['target.md']);

    session[Symbol.dispose]();

    const file = targetFile();
    expect(() => app.vault.modify(file, 'x')).toThrow(ResourceLockedError);
  });

  it('should be safe to dispose a session twice', () => {
    const session = new EditorLockComponent(app, 'test-plugin').createOwnerSession();
    session[Symbol.dispose]();
    expect(() => {
      session[Symbol.dispose]();
    }).not.toThrow();
  });
});
