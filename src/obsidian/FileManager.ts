/**
 * @packageDocumentation FileManager
 * Contains utility functions for managing files in Obsidian.
 */

import type { App } from 'obsidian';

import type {
  MaybePromise,
  RetryOptions
} from '../Async.ts';
import { deepEqual } from '../Object.ts';
import type { PathOrFile } from './FileSystem.ts';
import { getFile } from './FileSystem.ts';
import type { CombinedFrontMatter } from './FrontMatter.ts';
import {
  parseFrontMatter,
  setFrontMatter
} from './FrontMatter.ts';
import { process } from './Vault.ts';

/**
 * Processes the front matter of a given file, allowing modifications via a provided function.
 *
 * @typeParam CustomFrontMatter - The type of custom front matter.
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param frontMatterFn - A function that modifies the front matter.
 * @param retryOptions - Optional. Configuration options for retrying the process. If not provided, default options will be used.
 * @returns A promise that resolves when the front matter has been processed and saved.
 */
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export async function processFrontMatter<CustomFrontMatter = unknown>(app: App, pathOrFile: PathOrFile, frontMatterFn: (frontMatter: CombinedFrontMatter<CustomFrontMatter>) => MaybePromise<void | null>, retryOptions: Partial<RetryOptions> = {}): Promise<void> {
  const file = getFile(app, pathOrFile);
  const DEFAULT_RETRY_OPTIONS: Partial<RetryOptions> = { timeoutInMilliseconds: 60000 };
  const overriddenOptions: Partial<RetryOptions> = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

  await process(app, file, async (content) => {
    const oldFrontMatter = parseFrontMatter<CustomFrontMatter>(content);
    const newFrontMatter = parseFrontMatter<CustomFrontMatter>(content);
    const result = await frontMatterFn(newFrontMatter);
    if (result === null) {
      return null;
    }

    if (deepEqual(oldFrontMatter, newFrontMatter)) {
      return content;
    }

    return setFrontMatter(content, newFrontMatter);
  }, overriddenOptions);
}

/**
 * Adds an alias to the front matter of a given file if it does not already exist.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param alias - The alias to add.
 * @returns A promise that resolves when the alias has been added.
 */
export async function addAlias(app: App, pathOrFile: PathOrFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
  }

  const file = getFile(app, pathOrFile);
  if (alias === file.basename) {
    return;
  }

  await processFrontMatter(app, pathOrFile, (frontMatter) => {
    if (!frontMatter.aliases) {
      frontMatter.aliases = [];
    }

    if (!frontMatter.aliases.includes(alias)) {
      frontMatter.aliases.push(alias);
    }
  });
}

/**
 * Deletes an alias from the front matter of a given file if it exists.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param alias - The alias to delete.
 * @returns A promise that resolves when the alias has been deleted.
 */
export async function deleteAlias(app: App, pathOrFile: PathOrFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
  }

  await processFrontMatter(app, pathOrFile, (frontMatter) => {
    if (!frontMatter.aliases) {
      return;
    }

    frontMatter.aliases = frontMatter.aliases.filter((a) => a != alias);

    if (frontMatter.aliases.length === 0) {
      delete frontMatter.aliases;
    }
  });
}
