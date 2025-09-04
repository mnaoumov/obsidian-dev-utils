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
import {
  isFrontmatterLinkCacheWithOffsets,
  toFrontmatterLinkCacheWithOffsets
} from './FrontmatterLinkCacheWithOffsets.ts';
import {
  isCanvasReference,
  referenceToFileChange
} from './Reference.ts';
import { process } from './Vault.ts';

/**
 * A file change in the vault.
 */
export interface FileChange {
  /**
   * A new content to replace the old content.
   */
  newContent: string;

  /**
   * An old content that will be replaced.
   */
  oldContent: string;

  /**
   * A reference that caused the change.
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
 * @param abortSignal - The abort signal to control the execution of the function.
 * @param content - The content to which the changes should be applied.
 * @param path - The path to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of content changes to apply.
 * @param shouldRetryOnInvalidChanges - Whether to retry the operation if the changes are invalid.
 * @returns A {@link Promise} that resolves to the updated content or to `null` if update didn't succeed.
 */
export async function applyContentChanges(
  abortSignal: AbortSignal,
  content: string,
  path: string,
  changesProvider: ValueProvider<FileChange[] | null, [content: string]>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  abortSignal.throwIfAborted();
  let changes = await resolveValue(changesProvider, abortSignal, content);
  abortSignal.throwIfAborted();
  if (changes === null) {
    return null;
  }

  const { frontmatter, hasFrontmatterError } = parseFrontmatterSafely(content, path);

  if (!validateChanges(changes, content, frontmatter, path, shouldRetryOnInvalidChanges)) {
    return shouldRetryOnInvalidChanges ? null : content;
  }

  changes = sortAndFilterChanges(changes);

  if (!validateChangeOverlaps(changes)) {
    return null;
  }

  const { frontmatterChanged, newContent } = applyContentChangesToText(changes, content, hasFrontmatterError, path);

  await applyFrontmatterChangesWithOffsets(abortSignal, frontmatter, frontmatterChanged, path);
  abortSignal.throwIfAborted();

  return buildFinalContent(newContent, frontmatter, frontmatterChanged);
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
  changesProvider: ValueProvider<FileChange[] | null, [content: string]>,
  processOptions: ProcessOptions = {},
  shouldRetryOnInvalidChanges = true
): Promise<void> {
  await process(app, pathOrFile, async (abortSignal, content) => {
    if (isCanvasFile(app, pathOrFile)) {
      return await applyCanvasChanges(abortSignal, content, getPath(app, pathOrFile), changesProvider, shouldRetryOnInvalidChanges);
    }

    return await applyContentChanges(abortSignal, content, getPath(app, pathOrFile), changesProvider, shouldRetryOnInvalidChanges);
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

/**
 * Converts a frontmatter change to a frontmatter change with offsets.
 *
 * @param fileChange - The file change to convert.
 * @returns The converted file change.
 */
export function toFrontmatterChangeWithOffsets(fileChange: FrontmatterChange): FrontmatterChangeWithOffsets {
  if (isFrontmatterChangeWithOffsets(fileChange)) {
    return fileChange;
  }

  return {
    ...fileChange,
    reference: toFrontmatterLinkCacheWithOffsets(fileChange.reference)
  };
}

async function applyCanvasChanges(
  abortSignal: AbortSignal,
  content: string,
  path: string,
  changesProvider: ValueProvider<FileChange[] | null, [content: string]>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  const changes = await resolveValue(changesProvider, abortSignal, content);
  abortSignal.throwIfAborted();
  if (changes === null) {
    return null;
  }

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
    node.text = await applyContentChanges(
      abortSignal,
      node.text,
      `${path}.node${String(nodeIndex)}.VIRTUAL_FILE.md`,
      contentChanges,
      shouldRetryOnInvalidChanges
    );
  }

  return JSON.stringify(canvasData, null, '\t');
}

function applyContentChangesToText(
  changes: FileChange[],
  content: string,
  hasFrontmatterError: boolean,
  path: string
): { frontmatterChanged: Map<string, FrontmatterChangeWithOffsets[]>; newContent: string } {
  let newContent = '';
  let lastIndex = 0;
  const frontmatterChangesWithOffsetMap = new Map<string, FrontmatterChangeWithOffsets[]>();

  for (const change of changes) {
    if (isContentChange(change)) {
      newContent += content.slice(lastIndex, change.reference.position.start.offset);
      newContent += change.newContent;
      lastIndex = change.reference.position.end.offset;
    } else if (isFrontmatterChange(change)) {
      if (hasFrontmatterError) {
        console.error(`Cannot apply frontmatter change in ${path}, because frontmatter parsing failed`, { change });
      } else {
        let frontmatterChangesWithOffsets = frontmatterChangesWithOffsetMap.get(change.reference.key);
        if (!frontmatterChangesWithOffsets) {
          frontmatterChangesWithOffsets = [];
          frontmatterChangesWithOffsetMap.set(change.reference.key, frontmatterChangesWithOffsets);
        }
        frontmatterChangesWithOffsets.push(toFrontmatterChangeWithOffsets(change));
      }
    }
  }

  newContent += content.slice(lastIndex);

  return { frontmatterChanged: frontmatterChangesWithOffsetMap, newContent };
}

async function applyFrontmatterChangesWithOffsets(
  abortSignal: AbortSignal,
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

    const newPropertyValue = await applyContentChanges(abortSignal, propertyValue, `${path}.frontmatter.${key}.VIRTUAL_FILE.md`, contentChanges);
    if (newPropertyValue === null) {
      return;
    }

    setNestedPropertyValue(frontmatter, key, newPropertyValue);
  }
}

function buildFinalContent(
  newContent: string,
  frontmatter: CombinedFrontmatter<unknown>,
  frontmatterChanged: Map<string, FrontmatterChangeWithOffsets[]>
): string {
  if (frontmatterChanged.size > 0) {
    return setFrontmatter(newContent, frontmatter);
  }
  return newContent;
}

function parseFrontmatterSafely(content: string, path: string): { frontmatter: CombinedFrontmatter<unknown>; hasFrontmatterError: boolean } {
  let frontmatter: CombinedFrontmatter<unknown> = {};
  let hasFrontmatterError = false;

  try {
    frontmatter = parseFrontmatter(content);
  } catch (error) {
    console.error(new Error(`Frontmatter parsing failed in ${path}`, { cause: error }));
    hasFrontmatterError = true;
  }

  return { frontmatter, hasFrontmatterError };
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

function sortAndFilterChanges(changes: FileChange[]): FileChange[] {
  // Sort changes by type and position
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

  // Filter out duplicate and no-op changes
  return changes.filter((change, index) => {
    if (change.oldContent === change.newContent) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    return !deepEqual(change, changes[index - 1]);
  });
}

function validateChangeOverlaps(changes: FileChange[]): boolean {
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
      isContentChange(previousChange)
      && isContentChange(change)
      && previousChange.reference.position.end.offset
      && previousChange.reference.position.end.offset > change.reference.position.start.offset
    ) {
      console.warn('Overlapping changes', { change, previousChange });
      return false;
    }
  }
  return true;
}

function validateChanges(changes: FileChange[], content: string, frontmatter: CombinedFrontmatter<unknown>, path: string, shouldShowWarning: boolean): boolean {
  const validateChangesDebugger = getDebugger('FileChange:validateChanges');
  const logger = shouldShowWarning ? console.warn.bind(console) : validateChangesDebugger;
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
