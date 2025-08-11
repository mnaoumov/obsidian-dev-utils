/**
 * @packageDocumentation
 *
 * Contains utility types and functions for handling file changes in Obsidian.
 */

import type {
  App,
  FrontmatterLinkCache,
  Reference,
  ReferenceCache
} from 'obsidian';
import type { CanvasData } from 'obsidian/Canvas.d.ts';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from 'obsidian-typings/implementations';

import type { GenericObject } from '../ObjectUtils.ts';
import type { ValueProvider } from '../ValueProvider.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';
import type { FrontmatterLinkCacheWithOffsets } from './FrontmatterLinkCacheWithOffsets.ts';
import type {
  CanvasFileNodeReference,
  CanvasReference,
  CanvasTextNodeReference
} from './Reference.ts';
import type { ProcessOptions } from './Vault.ts';

import { getDebugger } from '../Debug.ts';
import {
  deepEqual,
  getNestedPropertyValue,
  setNestedPropertyValue
} from '../ObjectUtils.ts';
import { resolveValue } from '../ValueProvider.ts';
import {
  getPath,
  isCanvasFile
} from './FileSystem.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './Frontmatter.ts';
import { isFrontmatterLinkCacheWithOffsets } from './FrontmatterLinkCacheWithOffsets.ts';
import {
  isCanvasReference,
  referenceToFileChange
} from './Reference.ts';
import { process } from './Vault.ts';

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

  /**
   * The reference that caused the change.
   */
  reference: Reference;
}
type CanvasChange = { reference: CanvasReference } & FileChange;
type CanvasFileNodeChange = { reference: CanvasFileNodeReference } & FileChange;
type CanvasTextNodeChange = { reference: CanvasTextNodeReference } & FileChange;
type ContentChange = { reference: ReferenceCache } & FileChange;
type FrontmatterChange = { reference: FrontmatterLinkCache } & FileChange;
type FrontmatterChangeWithOffsets = { reference: FrontmatterLinkCacheWithOffsets } & FileChange;

/**
 * Applies a series of content changes to the specified content.
 *
 * @param content - The content to which the changes should be applied.
 * @param path - The path to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of content changes to apply.
 * @param shouldRetryOnInvalidChanges - Whether to retry the operation if the changes are invalid.
 * @returns A {@link Promise} that resolves to the updated content or to `null` if update didn't succeed.
 */
export async function applyContentChanges(
  content: string,
  path: string,
  changesProvider: ValueProvider<FileChange[]>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  let changes = await resolveValue(changesProvider);
  let frontmatter: CombinedFrontmatter<unknown> = {};
  let hasFrontmatterError = false;
  try {
    frontmatter = parseFrontmatter(content);
  } catch (error) {
    console.error(new Error(`Frontmatter parsing failed in ${path}`, { cause: error }));
    hasFrontmatterError = true;
  }

  if (!validateChanges(changes, content, frontmatter, path, shouldRetryOnInvalidChanges)) {
    return shouldRetryOnInvalidChanges ? null : content;
  }

  changes.sort((a, b) => {
    if (isContentChange(a) && isContentChange(b)) {
      return a.reference.position.start.offset - b.reference.position.start.offset;
    }

    if (isFrontmatterChangeWithOffsets(a) && isFrontmatterChangeWithOffsets(b)) {
      return a.reference.key.localeCompare(b.reference.key) || a.reference.startOffset - b.reference.startOffset;
    }

    if (isFrontmatterChange(a) && isFrontmatterChange(b)) {
      return a.reference.key.localeCompare(b.reference.key);
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
      isContentChange(previousChange) && isContentChange(change) && previousChange.reference.position.end.offset
      && previousChange.reference.position.end.offset > change.reference.position.start.offset
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

  const frontmatterChangesWithOffsetMap = new Map<string, FrontmatterChangeWithOffsets[]>();

  for (const change of changes) {
    if (isContentChange(change)) {
      newContent += content.slice(lastIndex, change.reference.position.start.offset);
      newContent += change.newContent;
      lastIndex = change.reference.position.end.offset;
    } else if (isFrontmatterChangeWithOffsets(change)) {
      if (hasFrontmatterError) {
        console.error(`Cannot apply frontmatter change in ${path}, because frontmatter parsing failed`, {
          change
        });
      } else {
        let frontmatterChangesWithOffsets = frontmatterChangesWithOffsetMap.get(change.reference.key);
        if (!frontmatterChangesWithOffsets) {
          frontmatterChangesWithOffsets = [];
          frontmatterChangesWithOffsetMap.set(change.reference.key, frontmatterChangesWithOffsets);
        }
        frontmatterChangesWithOffsets.push(change);
        frontmatterChanged = true;
      }
    } else if (isFrontmatterChange(change)) {
      if (hasFrontmatterError) {
        console.error(`Cannot apply frontmatter change in ${path}, because frontmatter parsing failed`, {
          change
        });
      } else {
        setNestedPropertyValue(frontmatter, change.reference.key, change.newContent);
        frontmatterChanged = true;
      }
    }
  }

  await applyFrontmatterChangesWithOffsets(frontmatter, frontmatterChangesWithOffsetMap, path);

  newContent += content.slice(lastIndex);
  if (frontmatterChanged) {
    newContent = setFrontmatter(newContent, frontmatter);
  }

  return newContent;
}

/**
 * Applies a series of file changes to the specified file or path within the application.
 *
 * @param app - The application instance where the file changes will be applied.
 * @param pathOrFile - The path or file to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of file changes to apply.
 * @param processOptions - Optional options for processing/retrying the operation.
 * @param shouldRetryOnInvalidChanges - Whether to retry the operation if the changes are invalid.
 *
 * @returns A {@link Promise} that resolves when the file changes have been successfully applied.
 */
export async function applyFileChanges(
  app: App,
  pathOrFile: PathOrFile,
  changesProvider: ValueProvider<FileChange[]>,
  processOptions: ProcessOptions = {},
  shouldRetryOnInvalidChanges = true
): Promise<void> {
  await process(app, pathOrFile, async (content) => {
    if (isCanvasFile(app, pathOrFile)) {
      return applyCanvasChanges(content, getPath(app, pathOrFile), changesProvider, shouldRetryOnInvalidChanges);
    }

    return await applyContentChanges(content, getPath(app, pathOrFile), changesProvider, shouldRetryOnInvalidChanges);
  }, processOptions);
}

/**
 * Checks if a file change is a canvas change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas change.
 */
export function isCanvasChange(change: FileChange): change is CanvasChange {
  return isCanvasReference(change.reference);
}

/**
 * Checks if a file change is a canvas file node change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas file node change.
 */
export function isCanvasFileNodeChange(change: FileChange): change is CanvasFileNodeChange {
  return isCanvasChange(change) && change.reference.type === 'file';
}

/**
 * Checks if a file change is a canvas text node change.
 *
 * @param change - The file change to check.
 * @returns Whether the file change is a canvas text node change.
 */
export function isCanvasTextNodeChange(change: FileChange): change is CanvasTextNodeChange {
  return isCanvasChange(change) && change.reference.type === 'text';
}

/**
 * Checks if a file change is a content change.
 *
 * @param fileChange - The file change to check.
 * @returns A boolean indicating whether the file change is a content change.
 */
export function isContentChange(fileChange: FileChange): fileChange is ContentChange {
  return isReferenceCache(fileChange.reference);
}

/**
 * Checks if a file change is a frontmatter change.
 *
 * @param fileChange - The file change to check.
 * @returns A boolean indicating whether the file change is a frontmatter change.
 */
export function isFrontmatterChange(fileChange: FileChange): fileChange is FrontmatterChange {
  return isFrontmatterLinkCache(fileChange.reference);
}

/**
 * Checks if a file change is a frontmatter change with offsets.
 *
 * @param fileChange - The file change to check.
 * @returns A boolean indicating whether the file change is a frontmatter change with offsets.
 */
export function isFrontmatterChangeWithOffsets(fileChange: FileChange): fileChange is FrontmatterChangeWithOffsets {
  return isFrontmatterLinkCacheWithOffsets(fileChange.reference);
}

async function applyCanvasChanges(
  content: string,
  path: string,
  changesProvider: ValueProvider<FileChange[]>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  const changes = await resolveValue(changesProvider);
  const canvasData = parseJsonSafe(content) as CanvasData;

  const canvasTextChanges = new Map<number, CanvasTextNodeChange[]>();

  for (const change of changes) {
    if (!isCanvasChange(change)) {
      console.warn('Only canvas changes are supported for canvas files', {
        change,
        path
      });
      return null;
    }

    const node = canvasData.nodes[change.reference.nodeIndex];
    if (!node) {
      console.warn('Node not found', {
        nodeIndex: change.reference.nodeIndex,
        path
      });
      return null;
    }

    if (isCanvasFileNodeChange(change)) {
      if (node.file !== change.oldContent) {
        console.warn('Content mismatch', {
          actualContent: node.file as string | undefined,
          expectedContent: change.oldContent,
          nodeIndex: change.reference.nodeIndex,
          path,
          type: 'file'
        });

        return null;
      }
      node.file = change.newContent;
    } else if (isCanvasTextNodeChange(change)) {
      let canvasTextChangesForNode = canvasTextChanges.get(change.reference.nodeIndex);
      if (!canvasTextChangesForNode) {
        canvasTextChangesForNode = [];
        canvasTextChanges.set(change.reference.nodeIndex, canvasTextChangesForNode);
      }

      canvasTextChangesForNode.push(change);
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

    const contentChanges = canvasTextChangesForNode.map((change) => referenceToFileChange(change.reference.originalReference, change.newContent));
    node.text = await applyContentChanges(node.text, `${path}.node${String(nodeIndex)}.VIRTUAL_FILE.md`, contentChanges, shouldRetryOnInvalidChanges);
  }

  return JSON.stringify(canvasData, null, '\t');
}

async function applyFrontmatterChangesWithOffsets(
  frontmatter: CombinedFrontmatter<unknown>,
  frontmatterChangesWithOffsetMap: Map<string, FrontmatterChangeWithOffsets[]>,
  path: string
): Promise<void> {
  for (const [key, frontmatterChangesWithOffsets] of frontmatterChangesWithOffsetMap.entries()) {
    const propertyValue = getNestedPropertyValue(frontmatter, key);
    if (typeof propertyValue !== 'string') {
      return;
    }

    const contentChanges: ContentChange[] = frontmatterChangesWithOffsets.map((change) => ({
      newContent: change.newContent,
      oldContent: change.oldContent,
      reference: {
        link: '',
        original: '',
        position: {
          end: {
            col: change.reference.endOffset,
            line: 0,
            offset: change.reference.endOffset
          },
          start: {
            col: change.reference.startOffset,
            line: 0,
            offset: change.reference.startOffset
          }
        }
      }
    } as ContentChange));

    const newPropertyValue = await applyContentChanges(propertyValue, `${path}.frontmatter.${key}.VIRTUAL_FILE.md`, contentChanges);
    if (newPropertyValue === null) {
      return;
    }

    setNestedPropertyValue(frontmatter, key, newPropertyValue);
  }
}

function parseJsonSafe(content: string): GenericObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  if (parsed === null || typeof parsed !== 'object') {
    parsed = {};
  }

  return parsed as GenericObject;
}

function validateChanges(changes: FileChange[], content: string, frontmatter: CombinedFrontmatter<unknown>, path: string, shouldShowWarning: boolean): boolean {
  const _debugger = getDebugger('validateChanges');
  const logger = shouldShowWarning ? console.warn.bind(console) : _debugger;
  for (const change of changes) {
    if (isContentChange(change)) {
      const startOffset = change.reference.position.start.offset;
      const endOffset = change.reference.position.end.offset;
      const actualContent = content.slice(startOffset, endOffset);
      if (actualContent !== change.oldContent) {
        logger('Content mismatch', {
          actualContent,
          endOffset,
          expectedContent: change.oldContent,
          path,
          startOffset
        });

        return false;
      }
    } else if (isFrontmatterChangeWithOffsets(change)) {
      const propertyValue = getNestedPropertyValue(frontmatter, change.reference.key);
      if (typeof propertyValue !== 'string') {
        logger('Property value is not a string', {
          frontmatterKey: change.reference.key,
          path,
          propertyValue
        });
        return false;
      }

      const actualContent = propertyValue.slice(change.reference.startOffset, change.reference.endOffset);
      if (actualContent !== change.oldContent) {
        logger('Content mismatch', {
          actualContent,
          expectedContent: change.oldContent,
          frontmatterKey: change.reference.key,
          path,
          startOffset: change.reference.startOffset
        });

        return false;
      }
    } else if (isFrontmatterChange(change)) {
      const actualContent = getNestedPropertyValue(frontmatter, change.reference.key);
      if (actualContent !== change.oldContent) {
        logger('Content mismatch', {
          actualContent,
          expectedContent: change.oldContent,
          frontmatterKey: change.reference.key,
          path
        });

        return false;
      }
    }
  }

  return true;
}
