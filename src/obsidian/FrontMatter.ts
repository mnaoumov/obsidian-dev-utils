/**
 * @packageDocumentation FrontMatter
 * This module provides utility functions for processing and managing YAML front matter in Obsidian notes.
 */

import {
  App,
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml
} from 'obsidian';

import type {
  MaybePromise,
  RetryOptions
} from '../Async.ts';
import { deepEqual } from '../Object.ts';
import type { PathOrFile } from './FileSystem.ts';
import { getFile } from './FileSystem.ts';
import { process } from './Vault.ts';

/**
 * Represents the front matter of an Obsidian file.
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Default+properties}
 */
export interface ObsidianFrontMatter {
  /**
   * An array of aliases for the note.
   */
  aliases?: string[];

  /**
   * An array of CSS classes to apply to the note.
   */
  cssclasses?: string[];

  /**
   * An array of tags for the note.
   */
  tags?: string[];
}

/**
 * Represents the front matter for publishing in Obsidian.
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Properties+for+Obsidian+Publish}
 */
export interface ObsidianPublishFrontMatter {
  /**
   * The cover image for the note.
   */
  cover?: string;

  /**
   * The description for the note.
   */
  description?: string;

  /**
   * The image for the note.
   */
  image?: string;

  /**
   * The permanent link for the note.
   */
  permalink?: string;

  /**
   * Whether the note is published.
   */
  publish?: boolean;
}

/**
 * Represents the combined front matter of a document.
 * It is a union of custom front matter, Obsidian front matter, and additional properties.
 * @typeParam CustomFrontMatter - The type of custom front matter.
 */
export type CombinedFrontMatter<CustomFrontMatter> = CustomFrontMatter & ObsidianFrontMatter & Record<string, unknown>;

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
    const frontMatterInfo = getFrontMatterInfo(content);

    const oldFrontMatter = (parseYaml(frontMatterInfo.frontmatter) ?? {}) as CombinedFrontMatter<CustomFrontMatter>;
    const newFrontMatter = (parseYaml(frontMatterInfo.frontmatter) ?? {}) as CombinedFrontMatter<CustomFrontMatter>;
    const result = await frontMatterFn(newFrontMatter);
    if (result === null) {
      return null;
    }

    if (deepEqual(oldFrontMatter, newFrontMatter)) {
      return content;
    }

    if (Object.keys(newFrontMatter).length === 0) {
      return content.slice(frontMatterInfo.contentStart);
    }

    const newFrontMatterStr = stringifyYaml(newFrontMatter);

    return frontMatterInfo.exists
      ? content.slice(0, frontMatterInfo.from) + newFrontMatterStr + content.slice(frontMatterInfo.to)
      : '---\n' + newFrontMatterStr + '---\n' + content;
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
