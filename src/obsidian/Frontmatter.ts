/**
 * @packageDocumentation
 *
 * This module provides utility functions for processing and managing YAML front matter in Obsidian notes.
 */

import {
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml
} from 'obsidian';

import type { GenericObject } from '../ObjectUtils.ts';

import { insertAt } from '../String.ts';

/**
 * Represents the combined front matter of a document.
 * It is a union of custom front matter, Obsidian front matter, and additional properties.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 */
export type CombinedFrontmatter<CustomFrontmatter> = CustomFrontmatter & GenericObject & ObsidianFrontmatter;

/**
 * Represents the front matter of an Obsidian file.
 *
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Default+properties}
 */
export interface ObsidianFrontmatter {
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
 *
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Properties+for+Obsidian+Publish}
 */
export interface ObsidianPublishFrontmatter {
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
 * Parses the front matter of a given content string.
 *
 * @param content - The content string to parse.
 * @returns The parsed front matter.
 */
export function parseFrontmatter<CustomFrontmatter = unknown>(content: string): CombinedFrontmatter<CustomFrontmatter> {
  const frontmatterInfo = getFrontMatterInfo(content);
  return (parseYaml(frontmatterInfo.frontmatter) ?? {}) as CombinedFrontmatter<CustomFrontmatter>;
}

/**
 * Sets the front matter of a given content string.
 *
 * @param content - The content string to set the front matter in.
 * @param newFrontmatter - The new front matter to set.
 * @returns The new content string with the front matter set.
 */
export function setFrontmatter(content: string, newFrontmatter: object): string {
  const frontmatterInfo = getFrontMatterInfo(content);
  if (Object.keys(newFrontmatter).length === 0) {
    return content.slice(frontmatterInfo.contentStart);
  }

  const newFrontmatterStr = stringifyYaml(newFrontmatter);

  return frontmatterInfo.exists
    ? insertAt(content, newFrontmatterStr, frontmatterInfo.from, frontmatterInfo.to)
    : `---\n${newFrontmatterStr}---\n${content}`;
}
