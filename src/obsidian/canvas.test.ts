// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { ResourceLockComponent } from './resource-lock.ts';

import { noop } from '../function.ts';
import { strictProxy } from '../strict-proxy.ts';
import { assertNonNullable } from '../type-guards.ts';
import { getCanvasReferences } from './canvas.ts';
import { applyFileChanges } from './file-change.ts';
import { referenceToFileChange } from './reference.ts';
import { readSafe } from './vault.ts';

interface ParsedCanvas {
  nodes: ParsedCanvasNode[];
}

interface ParsedCanvasNode {
  file?: string;
  text?: string;
}

const CANVAS_PATH = 'drawing.canvas';

function createApp(canvasContent: string): AppOriginal {
  return App.createConfigured__({
    files: { [CANVAS_PATH]: canvasContent }
  }).asOriginalType__();
}

function toCanvasJson(nodes: unknown[]): string {
  return JSON.stringify({ edges: [], nodes });
}

describe('getCanvasReferences', () => {
  it('should extract a file node reference', async () => {
    const app = createApp(toCanvasJson([{ file: 'old.md', id: '1', type: 'file' }]));
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references).toEqual([{
      isCanvas: true,
      key: 'nodes.0.file',
      link: 'old.md',
      nodeIndex: 0,
      original: 'old.md',
      type: 'file'
    }]);
  });

  it('should extract a text node reference for each embedded link', async () => {
    const app = createApp(toCanvasJson([{ id: '1', text: '![[a.png]]\n[[b]]', type: 'text' }]));
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references).toHaveLength(2);
    expect(references[0]).toMatchObject({
      isCanvas: true,
      key: 'nodes.0.text.0',
      link: 'a.png',
      nodeIndex: 0,
      original: '![[a.png]]',
      type: 'text'
    });
    expect(references[1]).toMatchObject({
      isCanvas: true,
      key: 'nodes.0.text.1',
      link: 'b',
      nodeIndex: 0,
      original: '[[b]]',
      type: 'text'
    });
    // The `originalReference` is the parsed body reference (with real positions) used to rewrite the embed.
    expect(references[0]).toHaveProperty('originalReference.link', 'a.png');
  });

  it('should extract references from mixed nodes and ignore unsupported node types', async () => {
    const app = createApp(toCanvasJson([
      { file: 'old.md', id: '1', type: 'file' },
      { id: 'g', type: 'group' },
      { id: '2', text: '![[c.png]]', type: 'text' }
    ]));
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references.map((reference) => reference.key)).toEqual(['nodes.0.file', 'nodes.2.text.0']);
  });

  it('should return an empty array when the canvas has no nodes property', async () => {
    const app = createApp(JSON.stringify({ edges: [] }));
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references).toEqual([]);
  });

  it('should return an empty array when the canvas JSON is null', async () => {
    const app = createApp('null');
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references).toEqual([]);
  });

  it('should return an empty array for malformed JSON', async () => {
    const app = createApp('not a canvas {');
    const references = await getCanvasReferences(app, CANVAS_PATH);
    expect(references).toEqual([]);
  });

  it('should return an empty array when the file is missing', async () => {
    const app = createApp(toCanvasJson([]));
    const references = await getCanvasReferences(app, 'missing.canvas');
    expect(references).toEqual([]);
  });
});

describe('getCanvasReferences rewrite round-trip via applyFileChanges', () => {
  const resourceLockComponent = strictProxy<ResourceLockComponent>({
    lockForPath: () => ({ [Symbol.dispose]: noop })
  });

  it('should rewrite both file-node and text-node references', async () => {
    const app = createApp(toCanvasJson([
      { file: 'old.md', id: '1', type: 'file' },
      { id: '2', text: '![[old.png]]', type: 'text' }
    ]));

    const references = await getCanvasReferences(app, CANVAS_PATH);
    const fileReference = references.find((reference) => reference.type === 'file');
    const textReference = references.find((reference) => reference.type === 'text');
    assertNonNullable(fileReference);
    assertNonNullable(textReference);

    const changes = [
      referenceToFileChange(fileReference, 'new.md'),
      referenceToFileChange(textReference, '![[new.png]]')
    ];

    await applyFileChanges({
      app,
      changesProvider: changes,
      pathOrFile: CANVAS_PATH,
      pluginNoticeComponent: null,
      resourceLockComponent
    });

    const updatedContent = await readSafe(app, CANVAS_PATH);
    assertNonNullable(updatedContent);
    const updated = JSON.parse(updatedContent) as ParsedCanvas;
    expect(updated.nodes[0]?.file).toBe('new.md');
    expect(updated.nodes[1]?.text).toBe('![[new.png]]');
  });
});
