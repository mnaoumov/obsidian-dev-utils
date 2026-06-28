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
  unlockEditorForPath
} from './editor-lock.ts';
import { toggleEditorReadOnly } from './editor.ts';
import { getPluginId } from './plugin/plugin-id.ts';

vi.mock('./editor.ts', () => ({
  toggleEditorReadOnly: vi.fn()
}));

vi.mock('./i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: GenericObject) => unknown) => fn({ obsidianDevUtils: { editorLock: { lockedByTooltip: 'Locked by', lockedNoteTooltip: 'Locked note' } } }))
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

function createMarkdownView(path: string, hasTabStatusContainer = true): MarkdownViewOriginal {
  const mockLeaf = WorkspaceLeaf.create2__(mockApp);
  castTo<MockLeafTabStatus>(mockLeaf).tabHeaderStatusContainerEl = hasTabStatusContainer ? createDiv() : null;
  const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
  const file = app.vault.getFileByPath(path);
  assertNonNullable(file);
  view.file = file;
  return view;
}

function leafOf(view: ViewOriginal): WorkspaceLeafOriginal {
  return strictProxy<WorkspaceLeafOriginal>({ view });
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

  it('should not re-lock a view that is already locked on a subsequent reconcile', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    app.workspace.trigger('layout-change');

    expect(vi.mocked(toggleEditorReadOnly)).toHaveBeenCalledTimes(1);
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
  function setActiveView(view: MarkdownViewOriginal | null): void {
    castTo<MockWorkspaceActiveView>(app.workspace).getActiveViewOfType = vi.fn(() => view);
  }

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
});
