/**
 * @packageDocumentation FrontMatter
 * This module provides utility functions for processing and managing YAML front matter in Obsidian notes.
 */

import {
  App,
} from "obsidian";
import { processWithRetry } from "./Vault.ts";
import {
  DEFAULT_SCHEMA,
  Type,
  load,
  dump
} from "js-yaml";
import {
  getFile,
  type PathOrFile
} from "./TFile.ts";
import type { MaybePromise } from "../Async.ts";

/**
 * Represents the front matter of an Obsidian file.
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Default+properties}
 */
export type ObsidianFrontMatter = {
  aliases?: string[];
  cssclasses?: string[];
  tags?: string[];
};

/**
 * Represents the front matter for publishing in Obsidian.
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Properties+for+Obsidian+Publish}
 */
export type ObsidianPublishFrontMatter = {
  cover?: string;
  description?: string;
  image?: string;
  permalink?: string;
  publish?: boolean;
};

/**
 * Represents the combined front matter of a document.
 * It is a union of custom front matter, Obsidian front matter, and additional properties.
 * @typeParam CustomFrontMatter - The type of custom front matter.
 */
export type CombinedFrontMatter<CustomFrontMatter> = CustomFrontMatter & ObsidianFrontMatter & Record<string, unknown>;

const TIMESTAMP_TYPE = new Type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: (data: unknown): boolean => data != null,
  construct: (data: unknown): string => String(data),
  represent: (data: object): unknown => data
});

const NO_TIMESTAMPS_YAML_SCHEMA = DEFAULT_SCHEMA.extend({
  explicit: [TIMESTAMP_TYPE]
});

const FRONT_MATTER_REG_EXP = /^---\r?\n((?:.|\r?\n)*?)\r?\n?---(?:\r?\n|$)((?:.|\r?\n)*)/;

/**
 * Processes the front matter of a given file, allowing modifications via a provided function.
 *
 * @function processFrontMatter
 * @typeParam CustomFrontMatter - The type of custom front matter.
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFile} pathOrFile - The path or TFile object representing the note.
 * @param {ValueProvider<void, [CustomFrontMatter]>} frontMatterFn - A function that modifies the front matter.
 * @returns {Promise<void>} A promise that resolves when the front matter has been processed and saved.
 */
export async function processFrontMatter<CustomFrontMatter = unknown>(app: App, pathOrFile: PathOrFile, frontMatterFn: (frontMatter: CombinedFrontMatter<CustomFrontMatter>) => MaybePromise<void>): Promise<void> {
  const file = getFile(app, pathOrFile);

  await processWithRetry(app, file, async (content) => {
    const match = content.match(FRONT_MATTER_REG_EXP);
    let frontMatterStr: string;
    let mainContent: string;
    if (match) {
      frontMatterStr = match[1]!;
      mainContent = match[2]!;
    } else {
      frontMatterStr = "";
      mainContent = content;
    }

    if (!mainContent) {
      mainContent = "\n";
    } else {
      mainContent = "\n" + mainContent.trim() + "\n";
    }

    const frontMatter = (load(frontMatterStr, { schema: NO_TIMESTAMPS_YAML_SCHEMA }) ?? {}) as CombinedFrontMatter<CustomFrontMatter>;
    await frontMatterFn(frontMatter);
    let newFrontMatterStr = dump(frontMatter, {
      lineWidth: -1,
      quotingType: "\"",
      schema: NO_TIMESTAMPS_YAML_SCHEMA
    });
    if (newFrontMatterStr === "{}\n") {
      newFrontMatterStr = "";
    }

    const newContent = `---
${newFrontMatterStr}---
${mainContent}`;

    return newContent;
  });
}

/**
 * Adds an alias to the front matter of a given file if it does not already exist.
 *
 * @function addAlias
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFile} pathOrFile - The path or TFile object representing the note.
 * @param {string} [alias] - The alias to add.
 * @returns {Promise<void>} A promise that resolves when the alias has been added.
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
 * Removes an alias from the front matter of a given file if it exists.
 *
 * @function removeAlias
 * @param {App} app - The Obsidian app instance.
 * @param {PathOrFile} pathOrFile - The path or TFile object representing the note.
 * @param {string} [alias] - The alias to remove.
 * @returns {Promise<void>} A promise that resolves when the alias has been removed.
 */
export async function removeAlias(app: App, pathOrFile: PathOrFile, alias?: string): Promise<void> {
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
