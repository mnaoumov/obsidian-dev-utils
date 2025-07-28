/**
 * @packageDocumentation
 *
 * Contains utility functions for managing files in Obsidian.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import type { MaybeReturn } from '../Type.ts';
import type { PathOrFile } from './FileSystem.ts';
import type { CombinedFrontmatter } from './Frontmatter.ts';
import type { ProcessOptions } from './Vault.ts';

import { deepEqual } from '../ObjectUtils.ts';
import { getFile } from './FileSystem.ts';
import {
  parseFrontmatter,
  setFrontmatter
} from './Frontmatter.ts';
import { process } from './Vault.ts';

/**
 * Adds an alias to the front matter of a given file if it does not already exist.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param alias - The alias to add.
 * @returns A {@link Promise} that resolves when the alias has been added.
 */
export async function addAlias(app: App, pathOrFile: PathOrFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
  }

  const file = getFile(app, pathOrFile);
  if (alias === file.basename) {
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
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or TFile object representing the note.
 * @param alias - The alias to delete.
 * @returns A {@link Promise} that resolves when the alias has been deleted.
 */
export async function deleteAlias(app: App, pathOrFile: PathOrFile, alias?: string): Promise<void> {
  if (!alias) {
    return;
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
 * @param processOptions - Optional. Configuration options for retrying the process. If not provided, default options will be used.
 * @returns A {@link Promise} that resolves when the front matter has been processed and saved.
 */
export async function processFrontmatter<CustomFrontmatter = unknown>(
  app: App,
  pathOrFile: PathOrFile,
  frontmatterFn: (frontmatter: CombinedFrontmatter<CustomFrontmatter>) => Promisable<MaybeReturn<null>>,
  processOptions: ProcessOptions = {}
): Promise<void> {
  const file = getFile(app, pathOrFile);

  await process(app, file, async (content) => {
    const oldFrontmatter = parseFrontmatter<CustomFrontmatter>(content);
    const newFrontmatter = parseFrontmatter<CustomFrontmatter>(content);
    const result = await frontmatterFn(newFrontmatter);
    if (result === null) {
      return null;
    }

    if (deepEqual(oldFrontmatter, newFrontmatter)) {
      return content;
    }

    return setFrontmatter(content, newFrontmatter);
  }, processOptions);
}
