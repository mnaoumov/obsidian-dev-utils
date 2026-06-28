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

import { noopAsync } from '../function.ts';
import { castTo } from '../object-utils.ts';
import { strictProxy } from '../strict-proxy.ts';
import { toggleEditorReadOnly } from './editor.ts';

const mocks = vi.hoisted(() => {
  const mockReconfigure = vi.fn((extension: unknown): StateEffect<unknown> => castTo<StateEffect<unknown>>({ reconfigure: extension }));
  const mockCompartmentOf = vi.fn((extension: unknown): Extension => castTo<Extension>({ compartmentOf: extension }));

  class MockCompartment {
    public of = mockCompartmentOf;
    public reconfigure = mockReconfigure;
  }

  const mockReadOnlyOf = vi.fn((value: boolean): Extension => castTo<Extension>({ facet: 'readOnly', value }));
  const mockAppendConfigOf = vi.fn((extension: unknown): StateEffect<unknown> => castTo<StateEffect<unknown>>({ appendConfig: extension }));

  return {
    mockAppendConfigOf,
    MockCompartment,
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
      dispatch: vi.fn()
    }
  });
}

describe('toggleEditorReadOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should not re-install the compartment on a subsequent toggle of the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();
    toggleEditorReadOnly(editor, true);
    vi.clearAllMocks();
    toggleEditorReadOnly(editor, true);

    expect(mocks.mockAppendConfigOf).not.toHaveBeenCalled();
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should install the compartment only once across repeated toggles on the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();

    toggleEditorReadOnly(editor, true);
    toggleEditorReadOnly(editor, false);

    // The `appendConfig` runs only on the first call (compartment installed once).
    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    // Lock: appendConfig + reconfigure (2 dispatches); unlock: reconfigure (1 dispatch).
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(3);
  });
});
