/**
 * @file
 *
 * Contains utility functions for managing files in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { MaybeReturn } from '../type.ts';
import type { EditorLockComponent } from './editor-lock.ts';
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
   * The editor-lock component used to lock the note while it is being modified.
   */
  readonly editorLockComponent: EditorLockComponent | undefined;

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
   * The editor-lock component used to lock the note while it is being modified.
   */
  readonly editorLockComponent: EditorLockComponent | undefined;

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
 * Parameters for {@link processFrontmatter}.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 */
export interface ProcessFrontmatterParams<CustomFrontmatter = unknown> extends ProcessFrontmatterOptions {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * A function that modifies the front matter.
   *
   * @param frontmatter - The front matter to modify.
   * @param abortSignal - The abort signal to listen to.
   * @returns A value that may be `null` to abort the process.
   */
  frontmatterFn(this: void, frontmatter: CombinedFrontmatter<CustomFrontmatter>, abortSignal: AbortSignal): Promisable<MaybeReturn<null>>;

  /**
   * The path or TFile object representing the note.
   */
  readonly pathOrFile: PathOrFile;
}

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
    editorLockComponent,
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

  await processFrontmatter({
    app,
    editorLockComponent,
    frontmatterFn: (frontmatter) => {
      frontmatter.aliases ??= [];

      if (!frontmatter.aliases.includes(alias)) {
        frontmatter.aliases.push(alias);
      }
    },
    pathOrFile
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
    editorLockComponent,
    pathOrFile
  } = params;
  if (!alias) {
    return;
  }

  if (!isMarkdownFile(pathOrFile)) {
    throw new Error(`File ${getPath(app, pathOrFile)} is not a markdown file.`);
  }

  await processFrontmatter({
    app,
    editorLockComponent,
    frontmatterFn: (frontmatter) => {
      if (!frontmatter.aliases) {
        return;
      }

      frontmatter.aliases = frontmatter.aliases.filter((a) => a !== alias);

      if (frontmatter.aliases.length === 0) {
        delete frontmatter.aliases;
      }
    },
    pathOrFile
  });
}

/**
 * Processes the front matter of a given file, allowing modifications via a provided function.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 * @param params - The parameters for processing the front matter.
 * @returns A {@link Promise} that resolves when the front matter has been processed and saved.
 */
export async function processFrontmatter<CustomFrontmatter = unknown>(params: ProcessFrontmatterParams<CustomFrontmatter>): Promise<void> {
  const {
    app,
    frontmatterFn,
    pathOrFile,
    ...options
  } = params;
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
