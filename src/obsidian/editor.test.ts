// @vitest-environment jsdom

import type {
  Extension,
  StateEffect
} from '@codemirror/state';
import type {
  App as AppOriginal,
  Editor,
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
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { assertNonNullable } from '../type-guards.ts';
import {
  syncOpenEditorBuffersForPath,
  toggleEditorReadOnly
} from './editor.ts';

const mocks = vi.hoisted(() => {
  const mockReconfigure = vi.fn((extension: unknown): StateEffect<unknown> => castTo<StateEffect<unknown>>({ reconfigure: extension }));
  const mockCompartmentOf = vi.fn((extension: unknown): Extension => castTo<Extension>({ compartmentOf: extension }));
  // Mock for `Compartment.get`, which reports whether the compartment is part of the configuration.
  // A non-`undefined` value means installed (so the compartment is reused); `undefined` means absent.
  // Defaults to installed; the re-install test overrides it to `undefined`.
  const mockCompartmentGet = vi.fn((): unknown => []);

  class MockCompartment {
    public get = mockCompartmentGet;
    public of = mockCompartmentOf;
    public reconfigure = mockReconfigure;
  }

  const mockReadOnlyOf = vi.fn((value: boolean): Extension => castTo<Extension>({ facet: 'readOnly', value }));
  const mockAppendConfigOf = vi.fn((extension: unknown): StateEffect<unknown> => castTo<StateEffect<unknown>>({ appendConfig: extension }));

  return {
    mockAppendConfigOf,
    MockCompartment,
    mockCompartmentGet,
    mockCompartmentOf,
    mockReadOnlyOf,
    mockReconfigure
  };
});

vi.mock('@codemirror/state', () => ({
  Compartment: mocks.MockCompartment,
  EditorState: {
    readOnly: {
      of: mocks.mockReadOnlyOf
    }
  },
  StateEffect: {
    appendConfig: {
      of: mocks.mockAppendConfigOf
    }
  }
}));

function createMockEditor(): Editor {
  return strictProxy<Editor>({
    cm: {
      dispatch: vi.fn(),
      state: castTo<Editor['cm']['state']>({})
    }
  });
}

describe('toggleEditorReadOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCompartmentGet.mockReturnValue([]);
  });

  it('should install the compartment and reconfigure it read-only on the first read-only toggle', async () => {
    await noopAsync();
    const editor = createMockEditor();
    toggleEditorReadOnly(editor, true);

    // The compartment is installed (initially empty) via appendConfig, then reconfigured read-only.
    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    expect(mocks.mockCompartmentOf).toHaveBeenCalledWith([]);
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should reconfigure the compartment to an empty extension when toggled editable', async () => {
    await noopAsync();
    const editor = createMockEditor();
    toggleEditorReadOnly(editor, false);

    expect(mocks.mockReconfigure).toHaveBeenLastCalledWith([]);
    expect(mocks.mockReadOnlyOf).not.toHaveBeenCalled();
  });

  it('should reuse the installed compartment on a subsequent toggle of the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();
    toggleEditorReadOnly(editor, true);
    vi.clearAllMocks();
    mocks.mockCompartmentGet.mockReturnValue([]);
    toggleEditorReadOnly(editor, true);

    expect(mocks.mockAppendConfigOf).not.toHaveBeenCalled();
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should re-install the compartment when the cached one is no longer in the configuration', async () => {
    await noopAsync();
    const editor = createMockEditor();
    toggleEditorReadOnly(editor, true);
    vi.clearAllMocks();
    // A `get` returning `undefined` simulates the view rebuilding its state and dropping the compartment.
    // The compartment must be installed again before the reconfigure can take hold.
    mocks.mockCompartmentGet.mockReturnValue(undefined);
    toggleEditorReadOnly(editor, true);

    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should install the compartment only once across repeated toggles on the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();

    toggleEditorReadOnly(editor, true);
    toggleEditorReadOnly(editor, false);

    // The `appendConfig` runs only on the first call (the compartment stays in the configuration).
    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    // First toggle: appendConfig + reconfigure (2 dispatches); second toggle: reconfigure (1 dispatch).
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(3);
  });
});

describe('syncOpenEditorBuffersForPath', () => {
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
  });

  it('should overwrite the buffer of a matching open editor whose content differs', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(view));

    syncOpenEditorBuffersForPath(app, 'note.md', 'RESTORED');

    expect(view.editor.getValue()).toBe('RESTORED');
  });

  it('should not overwrite a matching editor whose buffer already equals the content', () => {
    const view = createMarkdownView('note.md');
    view.editor.setValue('SAME');
    const setValueSpy = vi.spyOn(view.editor, 'setValue');
    stubLeaves(leafOf(view));

    syncOpenEditorBuffersForPath(app, 'note.md', 'SAME');

    expect(setValueSpy).not.toHaveBeenCalled();
  });

  it('should ignore leaves whose view is not a MarkdownView and still update a matching one', () => {
    const view = createMarkdownView('note.md');
    stubLeaves(leafOf(strictProxy<ViewOriginal>({})), leafOf(view));

    syncOpenEditorBuffersForPath(app, 'note.md', 'RESTORED');

    expect(view.editor.getValue()).toBe('RESTORED');
  });

  it('should not touch a view showing a different path', () => {
    const view = createMarkdownView('other.md');
    view.editor.setValue('OTHER');
    stubLeaves(leafOf(view));

    syncOpenEditorBuffersForPath(app, 'note.md', 'RESTORED');

    expect(view.editor.getValue()).toBe('OTHER');
  });

  it('should not touch a matching-type view without a file', () => {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
    const view = MarkdownView.create2__(mockLeaf).asOriginalType7__();
    view.editor.setValue('NO FILE');
    stubLeaves(leafOf(view));

    syncOpenEditorBuffersForPath(app, 'note.md', 'RESTORED');

    expect(view.editor.getValue()).toBe('NO FILE');
  });

  function createMarkdownView(path: string): MarkdownViewOriginal {
    const mockLeaf = WorkspaceLeaf.create2__(mockApp);
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
});
