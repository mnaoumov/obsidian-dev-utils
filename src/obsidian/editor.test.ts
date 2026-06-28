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
import {
  lockEditor,
  unlockEditor
} from './editor.ts';

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

describe('lockEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should install the compartment and reconfigure it read-only on first lock', async () => {
    await noopAsync();
    const editor = createMockEditor();
    lockEditor(editor);

    // The compartment is installed (initially empty) via appendConfig, then reconfigured read-only.
    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    expect(mocks.mockCompartmentOf).toHaveBeenCalledWith([]);
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should not re-install the compartment on a subsequent lock of the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();
    lockEditor(editor);
    vi.clearAllMocks();
    lockEditor(editor);

    expect(mocks.mockAppendConfigOf).not.toHaveBeenCalled();
    expect(mocks.mockReadOnlyOf).toHaveBeenCalledWith(true);
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should unlock the editor when the returned disposable is disposed', async () => {
    await noopAsync();
    const editor = createMockEditor();
    const disposable = lockEditor(editor);
    vi.clearAllMocks();
    disposable[Symbol.dispose]();

    // Unlock reconfigures the compartment back to an empty extension (no read-only).
    expect(mocks.mockReconfigure).toHaveBeenCalledWith([]);
    expect(mocks.mockReadOnlyOf).not.toHaveBeenCalled();
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(1);
  });

  it('should unlock the editor at the end of a using scope', async () => {
    await noopAsync();
    const editor = createMockEditor();
    {
      using _lock = lockEditor(editor);
      expect(mocks.mockReadOnlyOf).toHaveBeenLastCalledWith(true);
    }

    expect(mocks.mockReconfigure).toHaveBeenLastCalledWith([]);
  });
});

describe('unlockEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reconfigure the compartment to an empty extension', async () => {
    await noopAsync();
    const editor = createMockEditor();
    unlockEditor(editor);

    expect(mocks.mockReconfigure).toHaveBeenLastCalledWith([]);
    expect(mocks.mockReadOnlyOf).not.toHaveBeenCalled();
  });
});

describe('ensureCompartment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should install the compartment only once across repeated lock/unlock on the same editor', async () => {
    await noopAsync();
    const editor = createMockEditor();

    lockEditor(editor);
    unlockEditor(editor);

    // The `appendConfig` runs only on the first call (compartment installed once).
    expect(mocks.mockAppendConfigOf).toHaveBeenCalledTimes(1);
    // Lock: appendConfig + reconfigure (2 dispatches); unlock: reconfigure (1 dispatch).
    expect(editor.cm.dispatch).toHaveBeenCalledTimes(3);
  });
});
