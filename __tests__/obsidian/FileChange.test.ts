// @vitest-environment jsdom
import type { Reference } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { FileChange } from '../../src/obsidian/FileChange.ts';

import { getLibDebugger } from '../../src/Debug.ts';
import { noop } from '../../src/Function.ts';
import {
  applyContentChanges,
  applyFileChanges,
  isCanvasChange,
  isCanvasFileNodeChange,
  isCanvasTextNodeChange,
  isContentChange,
  isFrontmatterChange,
  isFrontmatterChangeWithOffsets,
  toFrontmatterChangeWithOffsets
} from '../../src/obsidian/FileChange.ts';
import { isCanvasFile } from '../../src/obsidian/FileSystem.ts';
import { process } from '../../src/obsidian/Vault.ts';
import { assertNonNullable } from '../../src/ObjectUtils.ts';

vi.mock('../../src/Debug.ts', () => ({
  getLibDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../../src/Error.ts', () => ({
  printError: vi.fn()
}));

vi.mock('../../src/obsidian/FileSystem.ts', () => ({
  getPath: vi.fn((_app: unknown, p: unknown) => typeof p === 'string' ? p : (p as { path: string }).path),
  isCanvasFile: vi.fn(() => false)
}));

vi.mock('../../src/obsidian/Vault.ts', () => ({
  process: vi.fn(async (_app: unknown, _pathOrFile: unknown, fn: unknown) => {
    const controller = new AbortController();
    await (fn as (signal: AbortSignal, content: string) => Promise<null | string>)(controller.signal, 'test content');
  })
}));

type ProcessFn = (signal: AbortSignal, content: string) => Promise<null | string>;

// --- Helper factories ---

function makeCanvasFileNodeChange(
  oldContent: string,
  newContent: string,
  nodeIndex: number
): FileChange {
  return {
    newContent,
    oldContent,
    reference: {
      displayText: oldContent,
      isCanvas: true,
      key: 'file',
      link: oldContent,
      nodeIndex,
      original: oldContent,
      type: 'file'
    } as Reference
  };
}

function makeCanvasTextNodeChange(
  oldContent: string,
  newContent: string,
  nodeIndex: number,
  originalRefStartOffset: number
): FileChange {
  return {
    newContent,
    oldContent,
    reference: {
      displayText: oldContent,
      isCanvas: true,
      key: 'text',
      link: oldContent,
      nodeIndex,
      original: oldContent,
      originalReference: {
        link: oldContent,
        original: oldContent,
        position: {
          end: { col: 0, line: 0, offset: originalRefStartOffset + oldContent.length },
          start: { col: 0, line: 0, offset: originalRefStartOffset }
        }
      },
      type: 'text'
    } as Reference
  };
}

function makeContentChange(
  oldContent: string,
  newContent: string,
  startOffset: number
): FileChange {
  return {
    newContent,
    oldContent,
    reference: {
      link: oldContent,
      original: oldContent,
      position: {
        end: { col: 0, line: 0, offset: startOffset + oldContent.length },
        start: { col: 0, line: 0, offset: startOffset }
      }
    } as Reference
  };
}

function makeFrontmatterChange(
  oldContent: string,
  newContent: string,
  key: string
): FileChange {
  return {
    newContent,
    oldContent,
    reference: {
      displayText: oldContent,
      key,
      link: oldContent,
      original: oldContent
    } as Reference
  };
}

function makeFrontmatterChangeWithOffsets(
  oldContent: string,
  newContent: string,
  key: string,
  startOffset: number,
  endOffset: number
): FileChange {
  return {
    newContent,
    oldContent,
    reference: {
      displayText: oldContent,
      endOffset,
      key,
      link: oldContent,
      original: oldContent,
      startOffset
    } as Reference
  };
}

// --- Type guard tests ---

describe('isCanvasChange', () => {
  it('should return true for a canvas file node change', () => {
    const change = makeCanvasFileNodeChange('old.md', 'new.md', 0);
    expect(isCanvasChange(change)).toBe(true);
  });

  it('should return true for a canvas text node change', () => {
    const change = makeCanvasTextNodeChange('[[old]]', '[[new]]', 0, 0);
    expect(isCanvasChange(change)).toBe(true);
  });

  it('should return false for a content change', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isCanvasChange(change)).toBe(false);
  });

  it('should return false for a frontmatter change', () => {
    const change = makeFrontmatterChange('old', 'new', 'aliases');
    expect(isCanvasChange(change)).toBe(false);
  });
});

describe('isCanvasFileNodeChange', () => {
  it('should return true for a canvas file node change', () => {
    const change = makeCanvasFileNodeChange('old.md', 'new.md', 0);
    expect(isCanvasFileNodeChange(change)).toBe(true);
  });

  it('should return false for a canvas text node change', () => {
    const change = makeCanvasTextNodeChange('[[old]]', '[[new]]', 0, 0);
    expect(isCanvasFileNodeChange(change)).toBe(false);
  });

  it('should return false for a content change', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isCanvasFileNodeChange(change)).toBe(false);
  });
});

describe('isCanvasTextNodeChange', () => {
  it('should return true for a canvas text node change', () => {
    const change = makeCanvasTextNodeChange('[[old]]', '[[new]]', 0, 0);
    expect(isCanvasTextNodeChange(change)).toBe(true);
  });

  it('should return false for a canvas file node change', () => {
    const change = makeCanvasFileNodeChange('old.md', 'new.md', 0);
    expect(isCanvasTextNodeChange(change)).toBe(false);
  });

  it('should return false for a content change', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isCanvasTextNodeChange(change)).toBe(false);
  });
});

describe('isContentChange', () => {
  it('should return true for a reference with position', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isContentChange(change)).toBe(true);
  });

  it('should return false for a frontmatter change', () => {
    const change = makeFrontmatterChange('old', 'new', 'aliases');
    expect(isContentChange(change)).toBe(false);
  });

  it('should return false for a canvas change', () => {
    const change = makeCanvasFileNodeChange('old.md', 'new.md', 0);
    expect(isContentChange(change)).toBe(false);
  });
});

describe('isFrontmatterChange', () => {
  it('should return true for a frontmatter link cache reference', () => {
    const change = makeFrontmatterChange('old', 'new', 'aliases');
    expect(isFrontmatterChange(change)).toBe(true);
  });

  it('should return false for a content change', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isFrontmatterChange(change)).toBe(false);
  });

  it('should return true for a frontmatter change with offsets (it is also a frontmatter change)', () => {
    const change = makeFrontmatterChangeWithOffsets('old', 'new', 'aliases', 0, 3);
    expect(isFrontmatterChange(change)).toBe(true);
  });
});

describe('isFrontmatterChangeWithOffsets', () => {
  it('should return true when reference has startOffset and endOffset', () => {
    const change = makeFrontmatterChangeWithOffsets('old', 'new', 'aliases', 0, 3);
    expect(isFrontmatterChangeWithOffsets(change)).toBe(true);
  });

  it('should return false for a frontmatter change without offsets', () => {
    const change = makeFrontmatterChange('old', 'new', 'aliases');
    expect(isFrontmatterChangeWithOffsets(change)).toBe(false);
  });

  it('should return false for a content change', () => {
    const change = makeContentChange('[[old]]', '[[new]]', 0);
    expect(isFrontmatterChangeWithOffsets(change)).toBe(false);
  });
});

// --- toFrontmatterChangeWithOffsets ---

describe('toFrontmatterChangeWithOffsets', () => {
  it('should return the same change if it already has offsets', () => {
    const change = makeFrontmatterChangeWithOffsets('old', 'new', 'aliases', 5, 8);
    const result = toFrontmatterChangeWithOffsets(change as never);
    expect(result).toBe(change);
  });

  it('should convert a frontmatter change without offsets by adding startOffset=0 and endOffset=original.length', () => {
    const change = makeFrontmatterChange('hello', 'world', 'aliases');
    const result = toFrontmatterChangeWithOffsets(change as never);
    expect(isFrontmatterChangeWithOffsets(result)).toBe(true);
    expect((result.reference as unknown as Record<string, unknown>)['startOffset']).toBe(0);
    expect((result.reference as unknown as Record<string, unknown>)['endOffset']).toBe(5);
  });

  it('should preserve all original properties on the converted change', () => {
    const change = makeFrontmatterChange('link-value', 'new-value', 'myKey');
    const result = toFrontmatterChangeWithOffsets(change as never);
    expect(result.newContent).toBe('new-value');
    expect(result.oldContent).toBe('link-value');
    expect((result.reference as unknown as Record<string, unknown>)['key']).toBe('myKey');
  });
});

// --- applyContentChanges ---

describe('applyContentChanges', () => {
  let signal: AbortSignal;

  beforeEach(() => {
    signal = new AbortController().signal;
  });

  it('should return null when changesProvider returns null', async () => {
    const result = await applyContentChanges(signal, 'some content', 'test.md', null);
    expect(result).toBeNull();
  });

  it('should return null when changesProvider function returns null', async () => {
    const provider = vi.fn().mockReturnValue(null);
    const result = await applyContentChanges(signal, 'some content', 'test.md', provider);
    expect(result).toBeNull();
  });

  it('should apply a single content change', async () => {
    const content = 'Hello [[old-link]] world';
    const changes = [makeContentChange('[[old-link]]', '[[new-link]]', 6)];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('Hello [[new-link]] world');
  });

  it('should apply multiple non-overlapping content changes', async () => {
    const content = 'A [[first]] B [[second]] C';
    const changes = [
      makeContentChange('[[first]]', '[[one]]', 2),
      makeContentChange('[[second]]', '[[two]]', 14)
    ];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('A [[one]] B [[two]] C');
  });

  it('should handle no-op changes (old === new) by filtering them out', async () => {
    const content = 'Hello [[same]] world';
    const changes = [makeContentChange('[[same]]', '[[same]]', 6)];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('Hello [[same]] world');
  });

  it('should handle content changes sorted out of order', async () => {
    const content = 'A [[second]] B [[first]] C';
    // Provide changes in reverse order; the function should sort them
    const changes = [
      makeContentChange('[[first]]', '[[one]]', 15),
      makeContentChange('[[second]]', '[[two]]', 2)
    ];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('A [[two]] B [[one]] C');
  });

  it('should handle abort signal that is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const changes = [makeContentChange('old', 'new', 0)];
    await expect(applyContentChanges(controller.signal, 'old content', 'test.md', changes))
      .rejects.toThrow();
  });

  it('should return null when content validation fails and shouldRetryOnInvalidChanges is true', async () => {
    const content = 'Hello world';
    // Create a change with wrong oldContent that does not match content at the offset
    const changes = [makeContentChange('WRONG', 'new', 0)];
    const result = await applyContentChanges(signal, content, 'test.md', changes, true);
    expect(result).toBeNull();
  });

  it('should return original content when validation fails and shouldRetryOnInvalidChanges is false', async () => {
    const content = 'Hello world';
    const changes = [makeContentChange('WRONG', 'new', 0)];
    const result = await applyContentChanges(signal, content, 'test.md', changes, false);
    expect(result).toBe('Hello world');
  });

  it('should filter out duplicate changes', async () => {
    const content = 'Hello [[old]] world';
    const change = makeContentChange('[[old]]', '[[new]]', 6);
    const changes = [change, { ...change, newContent: '[[new]]', oldContent: '[[old]]', reference: { ...change.reference } }];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('Hello [[new]] world');
  });

  it('should apply a change at the beginning of the content', async () => {
    const content = '[[old]] rest of text';
    const changes = [makeContentChange('[[old]]', '[[new]]', 0)];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('[[new]] rest of text');
  });

  it('should apply a change at the end of the content', async () => {
    const content = 'some text [[old]]';
    const changes = [makeContentChange('[[old]]', '[[new]]', 10)];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).toBe('some text [[new]]');
  });

  it('should handle empty content with no changes', async () => {
    const result = await applyContentChanges(signal, '', 'test.md', []);
    expect(result).toBe('');
  });

  it('should accept a function as changesProvider', async () => {
    const content = 'Hello [[old]] world';
    const provider = vi.fn((_signal: AbortSignal, c: string) => {
      expect(c).toBe(content);
      return [makeContentChange('[[old]]', '[[new]]', 6)];
    });
    const result = await applyContentChanges(signal, content, 'test.md', provider);
    expect(result).toBe('Hello [[new]] world');
    expect(provider).toHaveBeenCalledOnce();
  });

  it('should handle frontmatter changes', async () => {
    const content = '---\naliases: old-alias\n---\nBody text';
    const changes = [makeFrontmatterChange('old-alias', 'new-alias', 'aliases')];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
    expect(result).toContain('new-alias');
  });

  it('should handle frontmatter changes with offsets', async () => {
    const content = '---\naliases: old-alias\n---\nBody text';
    const changes = [makeFrontmatterChangeWithOffsets('old-alias', 'new-alias', 'aliases', 0, 9)];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
    expect(result).toContain('new-alias');
  });

  it('should handle content without frontmatter and frontmatter changes gracefully', async () => {
    // Content without frontmatter delimiters. getFrontMatterInfo returns exists: false.
    // ParseFrontmatter returns {}. The frontmatter change will fail validation because
    // GetNestedPropertyValue({}, 'aliases') returns undefined, not matching 'old'.
    const content = 'no frontmatter here';
    const changes = [makeFrontmatterChange('old', 'new', 'aliases')];
    const result = await applyContentChanges(signal, content, 'test.md', changes, true);
    // Validation fails because frontmatter key doesn't exist -> returns null
    expect(result).toBeNull();
  });

  it('should handle mixed content and frontmatter changes', async () => {
    // Compute the offset: '---\n' (4) + 'aliases: old-alias\n' (19) + '---\n' (4) = 27 + 'Hello ' (6) = 33
    const content = '---\naliases: old-alias\n---\nHello [[old]] world';
    const changes = [
      makeContentChange('[[old]]', '[[new]]', 33),
      makeFrontmatterChange('old-alias', 'new-alias', 'aliases')
    ];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
    expect(result).toContain('[[new]]');
    expect(result).toContain('new-alias');
  });
});

// --- applyFileChanges ---

describe('applyFileChanges', () => {
  beforeEach(() => {
    vi.mocked(process).mockClear();
    vi.mocked(isCanvasFile).mockReturnValue(false);
  });

  it('should call process with the correct arguments', async () => {
    const app = {} as never;
    const changes: FileChange[] = [];
    await applyFileChanges(app, 'test.md', changes);
    expect(process).toHaveBeenCalledWith(app, 'test.md', expect.any(Function), {});
  });

  it('should pass processOptions to process', async () => {
    const app = {} as never;
    const options = { timeoutInMilliseconds: 3000 };
    await applyFileChanges(app, 'test.md', [], options);
    expect(process).toHaveBeenCalledWith(app, 'test.md', expect.any(Function), options);
  });

  it('should invoke applyContentChanges for non-canvas files', async () => {
    vi.mocked(isCanvasFile).mockReturnValue(false);
    const app = {} as never;
    const changes = [makeContentChange('test', 'replaced', 0)];

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, 'test content');
    });

    await applyFileChanges(app, 'test.md', changes);
    expect(process).toHaveBeenCalled();
  });

  it('should invoke applyCanvasChanges for canvas files', async () => {
    vi.mocked(isCanvasFile).mockReturnValue(true);
    const app = {} as never;
    const canvasContent = JSON.stringify({
      edges: [],
      nodes: [{ file: 'old.md', id: 'node1', type: 'file' }]
    });
    const changes = [makeCanvasFileNodeChange('old.md', 'new.md', 0)];

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, canvasContent);
    });

    await applyFileChanges(app, 'drawing.canvas', changes);
    expect(process).toHaveBeenCalled();
  });
});

// --- Canvas change application (via applyFileChanges) ---

describe('canvas changes via applyFileChanges', () => {
  beforeEach(() => {
    vi.mocked(isCanvasFile).mockReturnValue(true);
  });

  it('should apply canvas file node changes', async () => {
    const canvasData = {
      edges: [],
      nodes: [{ file: 'old.md', id: '1', type: 'file' }]
    };
    const changes = [makeCanvasFileNodeChange('old.md', 'new.md', 0)];
    let resultContent: null | string = null;

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(resultContent).not.toBeNull();
    assertNonNullable(resultContent);
    const parsed = JSON.parse(resultContent) as Record<string, Record<string, unknown>[]>;
    const nodes = parsed['nodes'];
    assertNonNullable(nodes);
    const firstNode = nodes[0];
    assertNonNullable(firstNode);
    expect(firstNode['file']).toBe('new.md');
  });

  it('should return null for canvas file node change with content mismatch', async () => {
    const canvasData = {
      edges: [],
      nodes: [{ file: 'different.md', id: '1', type: 'file' }]
    };
    const changes = [makeCanvasFileNodeChange('old.md', 'new.md', 0)];
    let resultContent: null | string = null;

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(resultContent).toBeNull();
  });

  it('should return null when canvas node index is out of bounds', async () => {
    const canvasData = {
      edges: [],
      nodes: [{ file: 'old.md', id: '1', type: 'file' }]
    };
    const changes = [makeCanvasFileNodeChange('old.md', 'new.md', 5)];
    let resultContent: null | string = null;

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(resultContent).toBeNull();
  });

  it('should return null when changesProvider returns null for canvas', async () => {
    let resultContent: null | string = 'not null';

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, '{}');
    });

    await applyFileChanges({} as never, 'test.canvas', null as never);
    expect(resultContent).toBeNull();
  });

  it('should skip non-canvas changes in canvas mode and log error', async () => {
    const canvasData = {
      edges: [],
      nodes: []
    };
    const changes = [makeContentChange('old', 'new', 0)];

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should apply canvas text node changes using applyContentChanges', async () => {
    const canvasData = {
      edges: [],
      nodes: [{ id: '1', text: 'Hello [[old]] world', type: 'text' }]
    };
    const changes = [makeCanvasTextNodeChange('[[old]]', '[[new]]', 0, 6)];
    let resultContent: null | string = null;

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(resultContent).not.toBeNull();
    assertNonNullable(resultContent);
    const parsed = JSON.parse(resultContent) as Record<string, Record<string, unknown>[]>;
    const nodes = parsed['nodes'];
    assertNonNullable(nodes);
    const firstNode = nodes[0];
    assertNonNullable(firstNode);
    expect(firstNode['text']).toBe('Hello [[new]] world');
  });

  it('should handle invalid JSON canvas content by throwing', async () => {
    const changes = [makeCanvasFileNodeChange('old.md', 'new.md', 0)];

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      await (fn as ProcessFn)(controller.signal, 'not valid json');
    });

    // When JSON is invalid, it is parsed as {} without a nodes property,
    // Causing a TypeError when accessing canvasData.nodes[nodeIndex]
    await expect(applyFileChanges({} as never, 'test.canvas', changes)).rejects.toThrow(TypeError);
  });

  it('should return null when canvas text node text is not a string', async () => {
    const canvasData = {
      edges: [],
      nodes: [{ id: '1', text: 123, type: 'text' }]
    };
    const changes = [makeCanvasTextNodeChange('[[old]]', '[[new]]', 0, 0)];
    let resultContent: null | string = null;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      noop();
    });

    vi.mocked(process).mockImplementation(async (_app, _pathOrFile, fn) => {
      const controller = new AbortController();
      resultContent = await (fn as ProcessFn)(controller.signal, JSON.stringify(canvasData));
    });

    await applyFileChanges({} as never, 'test.canvas', changes);
    expect(resultContent).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// --- Validation edge cases ---

describe('validateChanges edge cases', () => {
  let signal: AbortSignal;

  beforeEach(() => {
    signal = new AbortController().signal;
  });

  it('should return null when frontmatter change with offsets has content mismatch', async () => {
    const content = '---\naliases: correct-value\n---\nBody';
    const changes = [makeFrontmatterChangeWithOffsets('WRONG', 'new', 'aliases', 0, 5)];
    const result = await applyContentChanges(signal, content, 'test.md', changes, true);
    expect(result).toBeNull();
  });

  it('should return null when frontmatter change with offsets targets non-string property', async () => {
    // ParseFrontmatter will parse "count: 42" as number, not string
    const content = '---\ncount: 42\n---\nBody';
    const changes = [makeFrontmatterChangeWithOffsets('42', 'new', 'count', 0, 2)];
    const result = await applyContentChanges(signal, content, 'test.md', changes, true);
    expect(result).toBeNull();
  });

  it('should return null when frontmatter change (without offsets) has content mismatch', async () => {
    const content = '---\naliases: actual-value\n---\nBody';
    const changes = [makeFrontmatterChange('WRONG', 'new', 'aliases')];
    const result = await applyContentChanges(signal, content, 'test.md', changes, true);
    expect(result).toBeNull();
  });
});

// --- sortAndFilterChanges behavior (tested through applyContentChanges) ---

describe('sortAndFilterChanges behavior', () => {
  let signal: AbortSignal;

  beforeEach(() => {
    signal = new AbortController().signal;
  });

  it('should sort content changes before frontmatter changes', async () => {
    // Offset: '---\n' (4) + 'aliases: old-alias\n' (19) + '---\n' (4) = 27 + 'Hello ' (6) = 33
    const content = '---\naliases: old-alias\n---\nHello [[old]] world';
    const contentChange = makeContentChange('[[old]]', '[[new]]', 33);
    const fmChange = makeFrontmatterChange('old-alias', 'new-alias', 'aliases');
    // Provide frontmatter first, content second
    const changes = [fmChange, contentChange];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
    expect(result).toContain('[[new]]');
    expect(result).toContain('new-alias');
  });

  it('should sort frontmatter changes by key', async () => {
    const content = '---\nalpha: old-a\nbeta: old-b\n---\nBody';
    const changes = [
      makeFrontmatterChange('old-b', 'new-b', 'beta'),
      makeFrontmatterChange('old-a', 'new-a', 'alpha')
    ];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
    expect(result).toContain('new-a');
    expect(result).toContain('new-b');
  });

  it('should sort frontmatter changes with offsets by key and then by startOffset', async () => {
    const content = '---\nmyKey: prefix old1 old2 suffix\n---\nBody';
    // Parsed value of myKey is "prefix old1 old2 suffix"
    // "old1" starts at index 7, "old2" starts at index 12
    const changes = [
      makeFrontmatterChangeWithOffsets('old2', 'new2', 'myKey', 12, 16),
      makeFrontmatterChangeWithOffsets('old1', 'new1', 'myKey', 7, 11)
    ];
    const result = await applyContentChanges(signal, content, 'test.md', changes);
    expect(result).not.toBeNull();
  });
});

// --- getLibDebugger usage ---

describe('debug logging', () => {
  it('should call getLibDebugger for validation', async () => {
    const signal = new AbortController().signal;
    const content = 'Hello world';
    const changes = [makeContentChange('MISMATCH', 'new', 0)];
    await applyContentChanges(signal, content, 'test.md', changes, true);
    expect(getLibDebugger).toHaveBeenCalledWith('FileChange:validateChanges');
  });
});
