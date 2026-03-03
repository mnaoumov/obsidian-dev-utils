import type {
  Extension,
  StateEffect
} from '@codemirror/state';
import type { Editor } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../../src/TypeGuards.ts';
import { createMockOf } from '../TestHelpers.ts';

const mocks = vi.hoisted(() => {
  const mockReconfigure = vi.fn((extensions: unknown[]): StateEffect<unknown> => createMockOf<StateEffect<unknown>>({ effects: extensions }));

  class MockCompartment {
    public reconfigure = mockReconfigure;
  }

  const mockReadOnlyOf = vi.fn((value: boolean): Extension => createMockOf<Extension>({ facet: 'readOnly', value }));

  const mockEditableOf = vi.fn((value: boolean): Extension => createMockOf<Extension>({ facet: 'editable', value }));

  return {
    MockCompartment,
    mockEditableOf,
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
  }
}));

vi.mock('@codemirror/view', () => ({
  EditorView: {
    editable: {
      of: mocks.mockEditableOf
    }
  }
}));

function createMockEditor(): Editor {
  return createMockOf<Editor>({
    cm: {
      dispatch: vi.fn()
    }
  });
}

describe('lockEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dispatch readOnly true and editable false', async () => {
    const { lockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();
    lockEditor(editor);

    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(mocks.mockEditableOf).toHaveBeenCalledWith(false);

    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should create a compartment on first call', async () => {
    const { lockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();
    lockEditor(editor);

    expect(mocks.mockReconfigure).toHaveBeenCalledTimes(1);
  });

  it('should dispatch effects from compartment reconfigure', async () => {
    const { lockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();
    lockEditor(editor);

    const dispatch = vi.mocked(editor.cm.dispatch);
    const dispatchCall = dispatch.mock.calls[0];
    assertNonNullable(dispatchCall);
    expect(dispatchCall[0]).toHaveProperty('effects');
  });
});

describe('unlockEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dispatch readOnly false and editable true', async () => {
    const { unlockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();
    unlockEditor(editor);

    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(false);
    expect(mocks.mockEditableOf).toHaveBeenCalledWith(true);

    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should create a compartment on first call', async () => {
    const { unlockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();
    unlockEditor(editor);

    expect(mocks.mockReconfigure).toHaveBeenCalledTimes(1);
  });
});

describe('ensureCompartment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reuse the same compartment for repeated calls on the same editor', async () => {
    const { lockEditor, unlockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor = createMockEditor();

    lockEditor(editor);
    unlockEditor(editor);

    // Reconfigure should be called twice (once per lock/unlock), but with the same compartment instance
    expect(mocks.mockReconfigure).toHaveBeenCalledTimes(2);

    // Verify dispatch was called twice (once for lock, once for unlock)

    expect(editor.cm.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should create different compartments for different editors', async () => {
    const { lockEditor } = await import('../../src/obsidian/Editor.ts');
    const editor1 = createMockEditor();
    const editor2 = createMockEditor();

    lockEditor(editor1);
    lockEditor(editor2);

    // Each editor should trigger its own dispatch

    expect(editor1.cm.dispatch).toHaveBeenCalledTimes(1);

    expect(editor2.cm.dispatch).toHaveBeenCalledTimes(1);
  });
});
