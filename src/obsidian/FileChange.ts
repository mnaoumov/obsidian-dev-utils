/**
 * @packageDocumentation FileChange
 * Contains utility types and functions for handling file changes in Obsidian.
 */

import type { App } from 'obsidian';
import type { CanvasData } from 'obsidian/Canvas.d.ts';

import type { ValueProvider } from '../ValueProvider.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { ProcessOptions } from './Vault.ts';

import {
  deepEqual,
  getNestedPropertyValue,
  setNestedPropertyValue
} from '../Object.ts';
import { resolveValue } from '../ValueProvider.ts';
import {
  getPath,
  isCanvasFile
} from './FileSystem.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './Frontmatter.ts';
import {
  getAllLinks,
  parseMetadata
} from './MetadataCache.ts';
import { referenceToFileChange } from './Reference.ts';
import { process } from './Vault.ts';

/**
 * Represents a canvas change in the Vault.
 */
export interface CanvasChange extends FileChange {
  /**
   * Whether the change is a canvas change.
   */
  isCanvas: true;

  /**
   * The index of the node in the canvas.
   */
  nodeIndex: number;

  /**
   * The type of link.
   */
  type: 'file' | 'text';
}

/**
 * Represents a change in a file node in a canvas.
 */
export interface CanvasFileNodeChange extends CanvasChange {
  /**
   * The type of link.
   */
  type: 'file';
}

/**
 * Represents a change in a text node in a canvas.
 */
export interface CanvasTextNodeChange extends CanvasChange {
  /**
   * The index of the link in the node.
   */
  linkIndex: number;

  /**
   * The type of link.
   */
  type: 'text';
}

/**
 * Represents a content body change in the Vault.
 */
export interface ContentChange extends FileChange {
  /**
   * The end index of the change in the file content.
   */
  endIndex: number;

  /**
   * The start index of the change in the file content.
   */
  startIndex: number;
}

/**
 * Represents a file change in the Vault.
 */
export interface FileChange {
  /**
   * The new content to replace the old content.
   */
  newContent: string;

  /**
   * The old content that will be replaced.
   */
  oldContent: string;
}

/**
 * Represents a frontmatter change in the Vault.
 */
export interface FrontmatterChange extends FileChange {
  /**
   * The key in the frontmatter to use for the link.
   */
  frontmatterKey: string;
}

/**
 * Applies a series of file changes to the specified file or path within the application.
 *
 * @param app - The application instance where the file changes will be applied.
 * @param pathOrFile - The path or file to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of file changes to apply.
 * @param processOptions - Optional options for processing/retrying the operation.
 *
 * @returns A promise that resolves when the file changes have been successfully applied.
 */
export async function applyFileChanges(
  app: App,
  pathOrFile: PathOrFile,
  changesProvider: ValueProvider<FileChange[]>,
  processOptions: ProcessOptions = {}
): Promise<void> {
  await process(app, pathOrFile, async (content) => {
    if (isCanvasFile(app, pathOrFile)) {
      return applyCanvasChanges(app, content, getPath(app, pathOrFile), changesProvider);
    }

    return await applyContentChanges(content, getPath(app, pathOrFile), changesProvider);
  }, processOptions);
}

/**
 * Checks if a file change is a canvas change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas change.
 */
export function isCanvasChange(change: FileChange): change is CanvasChange {
  return !!(change as Partial<CanvasChange>).isCanvas;
}

/**
 * Checks if a file change is a canvas file node change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas file node change.
 */
export function isCanvasFileNodeChange(change: FileChange): change is CanvasFileNodeChange {
  return isCanvasChange(change) && change.type === 'file';
}

/**
 * Checks if a file change is a canvas text node change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas text node change.
 */
export function isCanvasTextNodeChange(change: FileChange): change is CanvasTextNodeChange {
  return isCanvasChange(change) && change.type === 'text';
}

/**
 * Checks if a file change is a content change.
 *
 * @param fileChange - The file change to check.
 * @returns A boolean indicating whether the file change is a content change.
 */
export function isContentChange(fileChange: FileChange): fileChange is ContentChange {
  return (fileChange as Partial<ContentChange>).startIndex !== undefined;
}

/**
 * Checks if a file change is a frontmatter change.
 *
 * @param fileChange - The file change to check.
 * @returns A boolean indicating whether the file change is a frontmatter change.
 */
export function isFrontmatterChange(fileChange: FileChange): fileChange is FrontmatterChange {
  return (fileChange as Partial<FrontmatterChange>).frontmatterKey !== undefined;
}

async function applyCanvasChanges(app: App, content: string, path: string, changesProvider: ValueProvider<FileChange[]>): Promise<null | string> {
  const changes = await resolveValue(changesProvider);
  const canvasData = parseJsonSafe(content) as CanvasData;

  const canvasTextChanges = new Map<number, Map<number, CanvasTextNodeChange>>();

  for (const change of changes) {
    if (!isCanvasChange(change)) {
      console.warn('Only canvas changes are supported for canvas files', {
        change,
        path
      });
      return null;
    }

    const node = canvasData.nodes[change.nodeIndex];
    if (!node) {
      console.warn('Node not found', {
        nodeIndex: change.nodeIndex,
        path
      });
      return null;
    }

    if (isCanvasFileNodeChange(change)) {
      if (node.file !== change.oldContent) {
        console.warn('Content mismatch', {
          actualContent: node.file as string | undefined,
          expectedContent: change.oldContent,
          nodeIndex: change.nodeIndex,
          path,
          type: 'file'
        });

        return null;
      }
      node.file = change.newContent;
    } else if (isCanvasTextNodeChange(change)) {
      let canvasTextChangesForNode = canvasTextChanges.get(change.nodeIndex);
      if (!canvasTextChangesForNode) {
        canvasTextChangesForNode = new Map<number, CanvasTextNodeChange>();
        canvasTextChanges.set(change.nodeIndex, canvasTextChangesForNode);
      }

      canvasTextChangesForNode.set(change.linkIndex, change);
    }
  }

  for (const [nodeIndex, canvasTextChangesForNode] of canvasTextChanges.entries()) {
    const node = canvasData.nodes[nodeIndex];
    if (!node) {
      console.warn('Node not found', {
        nodeIndex,
        path
      });

      return null;
    }

    if (typeof node.text !== 'string') {
      console.warn('Node text is not a string', {
        nodeIndex,
        path
      });

      return null;
    }

    const cache = await parseMetadata(app, node.text);
    const links = getAllLinks(cache);
    const contentChanges: FileChange[] = [];

    for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
      const link = links[linkIndex];
      if (!link) {
        console.warn('Missing link', {
          linkIndex,
          nodeIndex,
          nodeText: node.text,
          path
        });

        return null;
      }

      const canvasTextChange = canvasTextChangesForNode.get(linkIndex);
      if (canvasTextChange) {
        const contentChange = referenceToFileChange(link, canvasTextChange.newContent);
        contentChange.oldContent = canvasTextChange.oldContent;
        contentChanges.push(contentChange);
      }
    }

    node.text = await applyContentChanges(node.text, `${path}.node${nodeIndex.toString()}.VIRTUAL_FILE.md`, contentChanges);
  }

  return JSON.stringify(canvasData, null, '\t');
}

async function applyContentChanges(content: string, path: string, changesProvider: ValueProvider<FileChange[]>): Promise<null | string> {
  let changes = await resolveValue(changesProvider);
  const frontmatter = parseFrontmatter(content);

  for (const change of changes) {
    if (isContentChange(change)) {
      const actualContent = content.slice(change.startIndex, change.endIndex);
      if (actualContent !== change.oldContent) {
        console.warn('Content mismatch', {
          actualContent,
          endIndex: change.endIndex,
          expectedContent: change.oldContent,
          path,
          startIndex: change.startIndex
        });

        return null;
      }
    } else if (isFrontmatterChange(change)) {
      const actualContent = getNestedPropertyValue(frontmatter, change.frontmatterKey);
      if (actualContent !== change.oldContent) {
        console.warn('Content mismatch', {
          actualContent,
          expectedContent: change.oldContent,
          frontmatterKey: change.frontmatterKey,
          path
        });

        return null;
      }
    }
  }

  changes.sort((a, b) => {
    if (isContentChange(a) && isContentChange(b)) {
      return a.startIndex - b.startIndex;
    }

    if (isFrontmatterChange(a) && isFrontmatterChange(b)) {
      return a.frontmatterKey.localeCompare(b.frontmatterKey);
    }

    return isContentChange(a) ? -1 : 1;
  });

  // BUG: https://forum.obsidian.md/t/bug-duplicated-links-in-metadatacache-inside-footnotes/85551
  changes = changes.filter((change, index) => {
    if (change.oldContent === change.newContent) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    return !deepEqual(change, changes[index - 1]);
  });

  for (let i = 1; i < changes.length; i++) {
    const change = changes[i];
    if (!change) {
      continue;
    }
    const previousChange = changes[i - 1];
    if (!previousChange) {
      continue;
    }

    if (
      isContentChange(previousChange) && isContentChange(change) && previousChange.endIndex && change.startIndex
      && previousChange.endIndex > change.startIndex
    ) {
      console.warn('Overlapping changes', {
        change,
        previousChange
      });
      return null;
    }
  }

  let newContent = '';
  let lastIndex = 0;
  let frontmatterChanged = false;

  for (const change of changes) {
    if (isContentChange(change)) {
      newContent += content.slice(lastIndex, change.startIndex);
      newContent += change.newContent;
      lastIndex = change.endIndex;
    } else if (isFrontmatterChange(change)) {
      setNestedPropertyValue(frontmatter, change.frontmatterKey, change.newContent);
      frontmatterChanged = true;
    }
  }

  newContent += content.slice(lastIndex);
  if (frontmatterChanged) {
    newContent = setFrontmatter(newContent, frontmatter);
  }

  return newContent;
}

function parseJsonSafe(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  if (parsed === null || typeof parsed !== 'object') {
    parsed = {};
  }

  return parsed as Record<string, unknown>;
}
