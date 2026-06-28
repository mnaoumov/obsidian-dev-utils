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
  isEditorLockedForPath,
  lockEditorForPath,
  unlockEditorForPath
} from './editor-lock.ts';
import {
  lockEditor,
  unlockEditor
} from './editor.ts';

vi.mock('./editor.ts', () => ({
  lockEditor: vi.fn(),
  unlockEditor: vi.fn()
}));

vi.mock('./i18n/i18n.ts', () => ({
  t: vi.fn((fn: (messages: GenericObject) => unknown) => {
    try {
      fn({ obsidianDevUtils: { editorLock: { lockedNoteTooltip: 'mock' } } });
    } catch { /* Ignore */ }
    return 'mock-tooltip';
  })
}));

interface MockLeafTabStatus {
  tabHeaderStatusContainerEl: HTMLElement | null;
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

    expect(vi.mocked(lockEditor)).toHaveBeenCalledWith(view.editor);
    expect(vi.mocked(view.addAction)).toHaveBeenCalledWith('lock', 'mock-tooltip', expect.any(Function));
  });

  it('should ignore leaves whose view is not a MarkdownView', () => {
    stubLeaves(leafOf(strictProxy<ViewOriginal>({})));
    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(lockEditor)).not.toHaveBeenCalled();
  });

  it('should ignore matching-type views without a file', () => {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
    const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(lockEditor)).not.toHaveBeenCalled();
  });

  it('should not lock views whose path differs', () => {
    const view = createMarkdownView('other.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    expect(vi.mocked(lockEditor)).not.toHaveBeenCalled();
  });

  it('should not re-lock a view that is already locked on a subsequent reconcile', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    lockEditorForPath(app, 'note.md');
    app.workspace.trigger('layout-change');

    expect(vi.mocked(lockEditor)).toHaveBeenCalledTimes(1);
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
    expect(vi.mocked(lockEditor)).not.toHaveBeenCalled();

    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));
    app.workspace.trigger('active-leaf-change');

    expect(vi.mocked(lockEditor)).toHaveBeenCalledWith(view.editor);
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
    expect(vi.mocked(unlockEditor)).toHaveBeenCalledWith(view.editor);
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
    expect(vi.mocked(unlockEditor)).toHaveBeenCalledWith(view.editor);
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

    expect(vi.mocked(unlockEditor)).not.toHaveBeenCalled();
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

    expect(vi.mocked(lockEditor)).toHaveBeenCalledWith(view.editor);
    expect(view.leaf.tabHeaderStatusContainerEl).toBeNull();
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
