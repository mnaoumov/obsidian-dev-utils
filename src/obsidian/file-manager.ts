/**
 * @file
 *
 * Contains utility functions for managing files in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { MaybeReturn } from '../type.ts';
import type { PathOrFile } from './file-system.ts';
import type { CombinedFrontmatter } from './frontmatter.ts';
import type {
  ProcessOptions,
  ProcessParams
} from './vault.ts';

import {
  deepEqual,
  normalizeOptionalProperties
} from '../object-utils.ts';
import {
  getFile,
  getPath,
  isMarkdownFile
} from './file-system.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './frontmatter.ts';
import { process } from './vault.ts';

/**
 * Parameters for {@link addAlias}.
 */
export interface AddAliasParams {
  /**
   * The alias to add.
   */
  readonly alias?: string;

  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The path or TFile object representing the note.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Parameters for {@link deleteAlias}.
 */
export interface DeleteAliasParams {
  /**
   * The alias to delete.
   */
  readonly alias?: string;

  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The path or TFile object representing the note.
   */
  readonly pathOrFile: PathOrFile;
}

/**
 * Options for {@link processFrontmatter}.
 */
export type ProcessFrontmatterOptions = ProcessOptions;

/**
 * Adds an alias to the front matter of a given file if it does not already exist.
 *
 * @param params - The parameters for adding the alias.
 * @returns A {@link Promise} that resolves when the alias has been added.
 */
export async function addAlias(params: AddAliasParams): Promise<void> {
  const {
    alias,
    app,
    pathOrFile
  } = params;
  if (!alias) {
    return;
  }

  const file = getFile({ app, pathOrFile });

  if (!isMarkdownFile(file)) {
    throw new Error(`File ${file.path} is not a markdown file.`);
  }

  if (alias === file.basename || alias === file.name) {
    return;
  }

  await processFrontmatter(app, pathOrFile, (frontmatter) => {
    frontmatter.aliases ??= [];

    if (!frontmatter.aliases.includes(alias)) {
      frontmatter.aliases.push(alias);
    }
  });
}

/**
 * Deletes an alias from the front matter of a given file if it exists.
 *
 * @param params - The parameters for deleting the alias.
 * @returns A {@link Promise} that resolves when the alias has been deleted.
 */
export async function deleteAlias(params: DeleteAliasParams): Promise<void> {
  const {
    alias,
    app,
    pathOrFile
  } = params;
  if (!alias) {
    return;
  }

  if (!isMarkdownFile(pathOrFile)) {
    throw new Error(`File ${getPath(app, pathOrFile)} is not a markdown file.`);
  }

  await processFrontmatter(app, pathOrFile, (frontmatter) => {
    if (!frontmatter.aliases) {
      return;
    }

    frontmatter.aliases = frontmatter.aliases.filter((a) => a !== alias);

    if (frontmatter.aliases.length === 0) {
      delete frontmatter.aliases;
    }
  });
}

/**
 * Processes the front matter of a given file, allowing modifications via a provided function.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param frontmatterFn - A function that modifies the front matter.
 * @param options - Optional. Configuration options for retrying the process. If not provided, default options will be used.
 * @returns A {@link Promise} that resolves when the front matter has been processed and saved.
 */
export async function processFrontmatter<CustomFrontmatter = unknown>(
  app: App,
  pathOrFile: PathOrFile,
  frontmatterFn: (frontmatter: CombinedFrontmatter<CustomFrontmatter>, abortSignal: AbortSignal) => Promisable<MaybeReturn<null>>,
  options: ProcessFrontmatterOptions = {}
): Promise<void> {
  if (!isMarkdownFile(pathOrFile)) {
    throw new Error(`File ${getPath(app, pathOrFile)} is not a markdown file.`);
  }

  await process(normalizeOptionalProperties<ProcessParams>({
    app,
    async newContentProvider({ abortSignal, content }) {
      abortSignal.throwIfAborted();

      const oldFrontmatter = parseFrontmatter<CustomFrontmatter>(content);
      const newFrontmatter = parseFrontmatter<CustomFrontmatter>(content);
      const result = await frontmatterFn(newFrontmatter, abortSignal);
      abortSignal.throwIfAborted();

      if (result === null) {
        return null;
      }

      if (deepEqual(oldFrontmatter, newFrontmatter)) {
        return content;
      }

      return setFrontmatter(content, newFrontmatter);
    },
    pathOrFile,
    ...options
  }));
}
