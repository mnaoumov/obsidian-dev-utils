/**
 * @packageDocumentation FileChange
 * Contains utility types and functions for handling file changes in Obsidian.
 */

import type { App } from 'obsidian';

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
import { process } from './Vault.ts';

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
export async function applyFileChanges(app: App, pathOrFile: PathOrFile, changesProvider: ValueProvider<FileChange[]>, processOptions: ProcessOptions = {}): Promise<void> {
  await process(app, pathOrFile, async (content) => {
    let changes = await resolveValue(changesProvider);
    const frontmatter = isCanvasFile(app, pathOrFile) ? JSON.parse(content) as Record<string, unknown> : parseFrontmatter(content);

    for (const change of changes) {
      if (isContentChange(change)) {
        const actualContent = content.slice(change.startIndex, change.endIndex);
        if (actualContent !== change.oldContent) {
          console.warn('Content mismatch', {
            actualContent,
            endIndex: change.endIndex,
            expectedContent: change.oldContent,
            path: getPath(app, pathOrFile),
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
            path: getPath(app, pathOrFile)
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

      if (isContentChange(previousChange) && isContentChange(change) && previousChange.endIndex && change.startIndex && previousChange.endIndex > change.startIndex) {
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

    if (isCanvasFile(app, pathOrFile)) {
      newContent = JSON.stringify(frontmatter, null, '\t');
    } else {
      newContent += content.slice(lastIndex);
      if (frontmatterChanged) {
        newContent = setFrontmatter(newContent, frontmatter);
      }
    }
    return newContent;
  }, processOptions);
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
