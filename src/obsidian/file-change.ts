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
} from '@obsidian-typings/obsidian-public-latest/implementations';

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
  ProcessOptions,
  ProcessParams
} from './vault.ts';

import { getLibDebugger } from '../debug.ts';
import { printError } from '../error.ts';
import {
  deepEqual,
  getNestedPropertyValue,
  normalizeOptionalProperties,
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
 * Options for {@link applyFileChanges}.
 */
export type ApplyFileChangesOptions = ProcessOptions;
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
interface ApplyCanvasChangesParams {
  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal: AbortSignal;

  /**
   * A provider that returns an array of file changes to apply.
   */
  readonly changesProvider: ValueProvider<FileChange[] | null, ContentArgs>;

  /**
   * The content to which the changes should be applied.
   */
  readonly content: string;

  /**
   * The path to which the changes should be applied.
   */
  readonly path: string;

  /**
   * Whether to retry the operation if the changes are invalid.
   */
  readonly shouldRetryOnInvalidChanges?: boolean;
}

interface ApplyContentChangesToTextParams {
  /**
   * The content changes to apply.
   */
  readonly changes: FileChange[];

  /**
   * The content to which the changes should be applied.
   */
  readonly content: string;

  /**
   * Whether parsing the frontmatter failed.
   */
  readonly hasFrontmatterError: boolean;

  /**
   * The path to which the changes should be applied.
   */
  readonly path: string;
}

interface ApplyContentChangesToTextResult {
  readonly frontmatterChanged: Map<string, FrontmatterChangeWithOffsets[]>;
  readonly newContent: string;
}

interface ApplyFrontmatterChangesWithOffsetsParams {
  /**
   * The abort signal to control the execution of the function.
   */
  readonly abortSignal: AbortSignal;

  /**
   * The frontmatter to which the changes should be applied.
   */
  readonly frontmatter: CombinedFrontmatter<unknown>;

  /**
   * A map of frontmatter keys to the frontmatter changes with offsets to apply.
   */
  readonly frontmatterChangesWithOffsetMap: Map<string, FrontmatterChangeWithOffsets[]>;

  /**
   * The path to which the changes should be applied.
   */
  readonly path: string;
}

interface BuildFinalContentParams {
  /**
   * The frontmatter to write into the final content.
   */
  readonly frontmatter: CombinedFrontmatter<unknown>;

  /**
   * A map of frontmatter keys to the frontmatter changes with offsets that were applied.
   */
  readonly frontmatterChanged: Map<string, FrontmatterChangeWithOffsets[]>;

  /**
   * The content to which the frontmatter should be applied.
   */
  readonly newContent: string;
}

type CanvasChange = FileChange & WithReference<CanvasReference>;
type CanvasFileNodeChange = FileChange & WithReference<CanvasFileNodeReference>;
type CanvasTextNodeChange = FileChange & WithReference<CanvasTextNodeReference>;
type ContentChange = FileChange & WithReference<ReferenceCache>;
type FrontmatterChange = FileChange & WithReference<FrontmatterLinkCache>;

type FrontmatterChangeWithOffsets = FileChange & WithReference<FrontmatterLinkCacheWithOffsets>;

interface ParseFrontmatterSafelyParams {
  /**
   * The content to parse the frontmatter from.
   */
  readonly content: string;

  /**
   * The path the content belongs to.
   */
  readonly path: string;
}

interface ParseFrontmatterSafelyResult {
  readonly frontmatter: CombinedFrontmatter<unknown>;
  readonly hasFrontmatterError: boolean;
}

interface ValidateChangesParams {
  /**
   * The content changes to validate.
   */
  readonly changes: FileChange[];

  /**
   * The content the changes should be validated against.
   */
  readonly content: string;

  /**
   * The frontmatter the changes should be validated against.
   */
  readonly frontmatter: CombinedFrontmatter<unknown>;

  /**
   * The path the changes should be validated against.
   */
  readonly path: string;
}

interface WithReference<R extends Reference> {
  reference: R;
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

  const { frontmatter, hasFrontmatterError } = parseFrontmatterSafely({ content, path });

  if (!validateChanges({ changes, content, frontmatter, path })) {
    return shouldRetryOnInvalidChanges ? null : content;
  }

  changes = sortAndFilterChanges(changes);

  const { frontmatterChanged, newContent } = applyContentChangesToText({ changes, content, hasFrontmatterError, path });

  await applyFrontmatterChangesWithOffsets({
    abortSignal,
    frontmatter,
    frontmatterChangesWithOffsetMap: frontmatterChanged,
    path
  });
  abortSignal.throwIfAborted();

  return buildFinalContent({ frontmatter, frontmatterChanged, newContent });
}

/**
 * Applies a series of file changes to the specified file or path within the application.
 *
 * @param app - The application instance where the file changes will be applied.
 * @param pathOrFile - The path or file to which the changes should be applied.
 * @param changesProvider - A provider that returns an array of file changes to apply.
 * @param options - Optional options for processing/retrying the operation.
 * @param shouldRetryOnInvalidChanges - Whether to retry the operation if the changes are invalid.
 *
 * @returns A {@link Promise} that resolves when the file changes have been successfully applied.
 */
export async function applyFileChanges(
  app: App,
  pathOrFile: PathOrFile,
  changesProvider: ValueProvider<FileChange[] | null, ContentArgs>,
  options: ApplyFileChangesOptions = {},
  shouldRetryOnInvalidChanges = true
): Promise<void> {
  await process(normalizeOptionalProperties<ProcessParams>({
    app,
    async newContentProvider({ abortSignal, content }) {
      if (isCanvasFile(pathOrFile)) {
        return await applyCanvasChanges({
          abortSignal,
          changesProvider,
          content,
          path: getPath(app, pathOrFile),
          shouldRetryOnInvalidChanges
        });
      }

      return await applyContentChanges(abortSignal, content, getPath(app, pathOrFile), changesProvider, shouldRetryOnInvalidChanges);
    },
    pathOrFile,
    ...options
  }));
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

async function applyCanvasChanges(params: ApplyCanvasChangesParams): Promise<null | string> {
  const {
    abortSignal,
    changesProvider,
    content,
    path,
    shouldRetryOnInvalidChanges = true
  } = params;
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

function applyContentChangesToText(params: ApplyContentChangesToTextParams): ApplyContentChangesToTextResult {
  const {
    changes,
    content,
    hasFrontmatterError,
    path
  } = params;
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

async function applyFrontmatterChangesWithOffsets(params: ApplyFrontmatterChangesWithOffsetsParams): Promise<void> {
  const {
    abortSignal,
    frontmatter,
    frontmatterChangesWithOffsetMap,
    path
  } = params;
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
    }));

    const newPropertyValue = await applyContentChanges(abortSignal, propertyValue, `${path}.frontmatter.${key}.VIRTUAL_FILE.md`, contentChanges);
    /* v8 ignore start -- Inner applyContentChanges uses validated offsets, so null is not expected. */
    if (newPropertyValue === null) {
      return;
    }
    /* v8 ignore stop */

    setNestedPropertyValue({
      obj: frontmatter,
      path: key,
      value: newPropertyValue
    });
  }
}

function buildFinalContent(params: BuildFinalContentParams): string {
  const {
    frontmatter,
    frontmatterChanged,
    newContent
  } = params;
  if (frontmatterChanged.size > 0) {
    return setFrontmatter(newContent, frontmatter);
  }
  return newContent;
}

function parseFrontmatterSafely(params: ParseFrontmatterSafelyParams): ParseFrontmatterSafelyResult {
  const { content, path } = params;
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

function validateChanges(params: ValidateChangesParams): boolean {
  const {
    changes,
    content,
    frontmatter,
    path
  } = params;
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
