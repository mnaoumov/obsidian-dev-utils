/**
 * @packageDocumentation FrontMatter
 * This module provides utility functions for processing and managing YAML front matter in Obsidian notes.
 */

import {
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml
} from 'obsidian';

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
 * Parses the front matter of a given content string.
 *
 * @param content - The content string to parse.
 * @returns The parsed front matter.
 */
export function parseFrontMatter<CustomFrontMatter = unknown>(content: string): CombinedFrontMatter<CustomFrontMatter> {
  const frontMatterInfo = getFrontMatterInfo(content);
  return (parseYaml(frontMatterInfo.frontmatter) ?? {}) as CombinedFrontMatter<CustomFrontMatter>;
}

/**
 * Sets the front matter of a given content string.
 *
 * @param content - The content string to set the front matter in.
 * @param newFrontMatter - The new front matter to set.
 * @returns The new content string with the front matter set.
 */
export function setFrontMatter(content: string, newFrontMatter: object): string {
  const frontMatterInfo = getFrontMatterInfo(content);
  if (Object.keys(newFrontMatter).length === 0) {
    return content.slice(frontMatterInfo.contentStart);
  }

  const newFrontMatterStr = stringifyYaml(newFrontMatter);

  return frontMatterInfo.exists
    ? content.slice(0, frontMatterInfo.from) + newFrontMatterStr + content.slice(frontMatterInfo.to)
    : '---\n' + newFrontMatterStr + '---\n' + content;
}
