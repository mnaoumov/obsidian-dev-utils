/**
 * @file
 *
 * Contains utility types and functions for handling file changes in Obsidian.
 */

import type {
  App,
  FrontmatterLinkCache,
  Reference,
  ReferenceCache
} from 'obsidian';
import type { CanvasData } from 'obsidian/canvas.d.ts';

import {
  isFrontmatterLinkCache,
  isReferenceCache
} from 'obsidian-typings/implementations';

import type { GenericObject } from '../type-guards.ts';
import type { ValueProvider } from '../value-provider.ts';
import type { PathOrFile } from './file-system.ts';
import type { FrontmatterLinkCacheWithOffsets } from './frontmatter-link-cache-with-offsets.ts';
import type { CombinedFrontmatter } from './frontmatter.ts';
import type {
  CanvasFileNodeReference,
  CanvasReference,
  CanvasTextNodeReference
} from './reference.ts';
import type {
  ContentArgs,
  ProcessOptions
} from './vault.ts';

import { getLibDebugger } from '../debug.ts';
import { printError } from '../error.ts';
import {
  deepEqual,
  getNestedPropertyValue,
  setNestedPropertyValue
} from '../object-utils.ts';
import { resolveValue } from '../value-provider.ts';
import {
  getPath,
  isCanvasFile
} from './file-system.ts';
import {
  isFrontmatterLinkCacheWithOffsets,
  toFrontmatterLinkCacheWithOffsets
} from './frontmatter-link-cache-with-offsets.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './frontmatter.ts';
import {
  isCanvasReference,
  referenceToFileChange
} from './reference.ts';
import { process } from './vault.ts';

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
interface ApplyContentChangesToTextResult {
  frontmatterChanged: Map<string, FrontmatterChangeWithOffsets[]>;
  newContent: string;
}
type CanvasChange = { reference: CanvasReference } & FileChange;
type CanvasFileNodeChange = { reference: CanvasFileNodeReference } & FileChange;
type CanvasTextNodeChange = { reference: CanvasTextNodeReference } & FileChange;
type ContentChange = { reference: ReferenceCache } & FileChange;
type FrontmatterChange = { reference: FrontmatterLinkCache } & FileChange;

type FrontmatterChangeWithOffsets = { reference: FrontmatterLinkCacheWithOffsets } & FileChange;

interface ParseFrontmatterSafelyResult {
  frontmatter: CombinedFrontmatter<unknown>;
  hasFrontmatterError: boolean;
}

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
  changesProvider: ValueProvider<FileChange[] | null, ContentArgs>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  abortSignal.throwIfAborted();
  let changes = await resolveValue(changesProvider, { abortSignal, content });
  abortSignal.throwIfAborted();
  if (changes === null) {
    return null;
  }

  const { frontmatter, hasFrontmatterError } = parseFrontmatterSafely(content, path);

  if (!validateChanges(changes, content, frontmatter, path)) {
    return shouldRetryOnInvalidChanges ? null : content;
  }

  changes = sortAndFilterChanges(changes);

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
  changesProvider: ValueProvider<FileChange[] | null, ContentArgs>,
  processOptions: ProcessOptions = {},
  shouldRetryOnInvalidChanges = true
): Promise<void> {
  await process(app, pathOrFile, async ({ abortSignal, content }) => {
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
  changesProvider: ValueProvider<FileChange[] | null, ContentArgs>,
  shouldRetryOnInvalidChanges = true
): Promise<null | string> {
  const changes = await resolveValue(changesProvider, { abortSignal, content });
  abortSignal.throwIfAborted();
  if (changes === null) {
    return null;
  }

  const canvasData = parseJsonSafe(content) as GenericObject<CanvasData>;

  const canvasTextChanges = new Map<number, CanvasTextNodeChange[]>();

  for (const change of changes) {
    if (!isCanvasChange(change)) {
      const message = 'Only canvas changes are supported for canvas files';
      console.error(message, {
        change,
        path
      });
      continue;
    }

    const node = canvasData.nodes[change.reference.nodeIndex];
    if (!node) {
      const message = 'Node not found';
      console.error(message, {
        nodeIndex: change.reference.nodeIndex,
        path
      });
      return null;
    }

    if (isCanvasFileNodeChange(change)) {
      if (node.file !== change.oldContent) {
        getLibDebugger('FileChange:applyCanvasChanges')('Content mismatch', {
          actualContent: node.file as string | undefined,
          expectedContent: change.oldContent,
          nodeIndex: change.reference.nodeIndex,
          path,
          type: 'file'
        });

        return null;
      }
      node.file = change.newContent;
      /* v8 ignore start -- The false branch of the else-if is unreachable; only 'file' and 'text' canvas node types exist. */
    } else if (isCanvasTextNodeChange(change)) {
      /* v8 ignore stop */
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
    /* v8 ignore start -- Node existence is already verified in the first loop above. */
    if (!node) {
      const message = 'Node not found';
      console.error(message, {
        nodeIndex,
        path
      });

      return null;
    }
    /* v8 ignore stop */

    if (typeof node.text !== 'string') {
      const message = 'Node text is not a string';
      console.error(message, {
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
): ApplyContentChangesToTextResult {
  let newContent = '';
  let lastIndex = 0;
  let lastContentChange: ContentChange = {
    newContent: '',
    oldContent: '',
    reference: {
      link: '',
      original: '',
      position: {
        end: { col: 0, line: 0, offset: 0 },
        start: { col: 0, line: 0, offset: 0 }
      }
    }
  };
  const frontmatterChangesWithOffsetMap = new Map<string, FrontmatterChangeWithOffsets[]>();

  for (const change of changes) {
    /* v8 ignore start -- All change types are handled; the false branch leads to other else-if checks. */
    if (isContentChange(change)) {
      /* v8 ignore stop */
      if (lastIndex <= change.reference.position.start.offset) {
        newContent += content.slice(lastIndex, change.reference.position.start.offset);
        newContent += change.newContent;
        lastIndex = change.reference.position.end.offset;
        lastContentChange = change;
      } else {
        const overlappingStartOffset = change.reference.position.start.offset - lastContentChange.reference.position.start.offset;
        const overlappingEndOffset = change.reference.position.end.offset - lastContentChange.reference.position.start.offset;
        const overlappingContent = lastContentChange.newContent.slice(overlappingStartOffset, overlappingEndOffset);
        if (overlappingContent !== change.oldContent) {
          const message = 'Overlapping changes';
          console.error(message, { change, lastContentChange });
          throw new Error(message);
        }
        newContent = newContent.slice(0, newContent.length - lastContentChange.newContent.length)
          + lastContentChange.newContent.slice(0, overlappingStartOffset)
          + change.newContent
          + lastContentChange.newContent.slice(overlappingEndOffset);
      }
      /* v8 ignore start -- All change types are handled above; no unknown change types in practice. */
    } else if (isFrontmatterChange(change)) {
      /* v8 ignore stop */
      /* v8 ignore start -- Validation rejects frontmatter changes when parsing fails, so this branch is unreachable. */
      if (hasFrontmatterError) {
        console.error(`Cannot apply frontmatter change in ${path}, because frontmatter parsing failed`, { change });
      } else {
        /* v8 ignore stop */
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
    /* v8 ignore start -- Validation ensures the property is a string before reaching this point. */
    if (typeof propertyValue !== 'string') {
      return;
    }
    /* v8 ignore stop */

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
    /* v8 ignore start -- Inner applyContentChanges uses validated offsets, so null is not expected. */
    if (newPropertyValue === null) {
      return;
    }
    /* v8 ignore stop */

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

function parseFrontmatterSafely(content: string, path: string): ParseFrontmatterSafelyResult {
  let frontmatter: CombinedFrontmatter<unknown> = {};
  let hasFrontmatterError = false;

  try {
    frontmatter = parseFrontmatter(content);
  } catch (error) {
    printError(new Error(`Frontmatter parsing failed in ${path}`, { cause: error }));
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

function validateChanges(changes: FileChange[], content: string, frontmatter: CombinedFrontmatter<unknown>, path: string): boolean {
  const validateChangesDebugger = getLibDebugger('FileChange:validateChanges');
  for (const change of changes) {
    /* v8 ignore start -- All change types are handled; the false branch leads to other else-if checks. */
    if (isContentChange(change)) {
      /* v8 ignore stop */
      const startOffset = change.reference.position.start.offset;
      const endOffset = change.reference.position.end.offset;
      const actualContent = content.slice(startOffset, endOffset);
      if (actualContent !== change.oldContent) {
        validateChangesDebugger('Content mismatch', {
          actualContent,
          endOffset,
          expectedContent: change.oldContent,
          path,
          startOffset
        });

        return false;
      }
      /* v8 ignore start -- All change types are handled; no unknown change types in practice. */
    } else if (isFrontmatterChangeWithOffsets(change)) {
      /* v8 ignore stop */
      const propertyValue = getNestedPropertyValue(frontmatter, change.reference.key);
      if (typeof propertyValue !== 'string') {
        validateChangesDebugger('Property value is not a string', {
          frontmatterKey: change.reference.key,
          path,
          propertyValue
        });
        return false;
      }

      const actualContent = propertyValue.slice(change.reference.startOffset, change.reference.endOffset);
      if (actualContent !== change.oldContent) {
        validateChangesDebugger('Content mismatch', {
          actualContent,
          expectedContent: change.oldContent,
          frontmatterKey: change.reference.key,
          path,
          startOffset: change.reference.startOffset
        });

        return false;
      }
      /* v8 ignore start -- All change types are handled above; no unknown change types in practice. */
    } else if (isFrontmatterChange(change)) {
      /* v8 ignore stop */
      const actualContent = getNestedPropertyValue(frontmatter, change.reference.key);
      if (actualContent !== change.oldContent) {
        validateChangesDebugger('Content mismatch', {
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
