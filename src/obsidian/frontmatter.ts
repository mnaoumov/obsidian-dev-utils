/**
 * @file
 *
 * This module provides utility functions for processing and managing YAML front matter in Obsidian notes.
 */

import {
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml
} from 'obsidian';

import type { GenericObject } from '../type-guards.ts';

import { filterInPlace } from '../array.ts';
import { insertAt } from '../string.ts';

/**
 * A combined front matter of a document.
 * It is a union of custom front matter, Obsidian front matter, and additional properties.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 */
export type CombinedFrontmatter<CustomFrontmatter> = GenericObject<CustomFrontmatter & ObsidianFrontmatter>;

/**
 * A front matter of an Obsidian file.
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
 * A front matter for publishing in Obsidian.
 *
 * @see {@link https://help.obsidian.md/Editing+and+formatting/Properties#Properties+for+Obsidian+Publish}
 */
export interface ObsidianPublishFrontmatter {
  /**
   * A cover image for the note.
   */
  cover?: string;

  /**
   * A description for the note.
   */
  description?: string;

  /**
   * An image for the note.
   */
  image?: string;

  /**
   * A permanent link for the note.
   */
  permalink?: string;

  /**
   * Whether the note is published.
   */
  publish?: boolean;
}

/**
 * Parameters for {@link removeEmptyFrontmatterValues}.
 */
export interface RemoveEmptyFrontmatterValuesParams {
  /**
   * The front matter object to remove the empty values from. It is modified in place.
   */
  readonly frontmatter: GenericObject;

  /**
   * Whether to remove arrays that are empty, including the ones that became empty after their own items were removed.
   *
   * @default `false`
   */
  readonly shouldRemoveEmptyArrays?: boolean;

  /**
   * Whether to remove plain objects that are empty, including the ones that became empty after their own properties were removed.
   *
   * @default `false`
   */
  readonly shouldRemoveEmptyObjects?: boolean;

  /**
   * Whether to remove `null` and `undefined` values. Both are treated the same: they are the two ways a key can be present but carry no value, and `undefined` cannot survive a YAML round-trip anyway.
   *
   * @default `false`
   */
  readonly shouldRemoveNulls?: boolean;
}

const KEY_PATH_SEPARATOR = '.';

/**
 * Removes empty values from a front matter object, recursing into nested objects and arrays.
 *
 * The traversal is bottom-up: a container is pruned before it is itself tested for emptiness, so a container that holds nothing but empty values is removed as well when the matching option is enabled.
 */
class EmptyFrontmatterValueRemover {
  private readonly removedKeyPaths: string[] = [];
  private readonly shouldRemoveEmptyArrays: boolean;
  private readonly shouldRemoveEmptyObjects: boolean;
  private readonly shouldRemoveNulls: boolean;

  /**
   * Creates a new remover, resolving the provided options against the defaults.
   *
   * @param params - The parameters for removing the empty front matter values.
   */
  public constructor(params: RemoveEmptyFrontmatterValuesParams) {
    this.shouldRemoveEmptyArrays = params.shouldRemoveEmptyArrays ?? false;
    this.shouldRemoveEmptyObjects = params.shouldRemoveEmptyObjects ?? false;
    this.shouldRemoveNulls = params.shouldRemoveNulls ?? false;
  }

  /**
   * Removes the empty values from the given front matter object, modifying it in place.
   *
   * @param frontmatter - The front matter object to remove the empty values from.
   * @returns The key paths of the removed values, in the order they were removed.
   */
  public remove(frontmatter: GenericObject): string[] {
    this.pruneObject(frontmatter, '');
    return this.removedKeyPaths;
  }

  private checkIsEmpty(value: unknown): boolean {
    if (value === '') {
      return true;
    }

    if (value === null || value === undefined) {
      return this.shouldRemoveNulls;
    }

    if (Array.isArray(value)) {
      return value.length === 0 && this.shouldRemoveEmptyArrays;
    }

    if (checkIsPlainObject(value)) {
      return Object.keys(value).length === 0 && this.shouldRemoveEmptyObjects;
    }

    return false;
  }

  private joinKeyPath(keyPath: string, key: string): string {
    return keyPath ? `${keyPath}${KEY_PATH_SEPARATOR}${key}` : key;
  }

  private prune(value: unknown, keyPath: string): void {
    if (Array.isArray(value)) {
      this.pruneArray(value, keyPath);
    } else if (checkIsPlainObject(value)) {
      this.pruneObject(value, keyPath);
    }
  }

  private pruneArray(array: unknown[], keyPath: string): void {
    filterInPlace(array, (item, index) => {
      const itemKeyPath = this.joinKeyPath(keyPath, String(index));
      this.prune(item, itemKeyPath);
      if (!this.checkIsEmpty(item)) {
        return true;
      }

      this.removedKeyPaths.push(itemKeyPath);
      return false;
    });
  }

  private pruneObject($object: GenericObject, keyPath: string): void {
    for (const [key, value] of Object.entries($object)) {
      const valueKeyPath = this.joinKeyPath(keyPath, key);
      this.prune(value, valueKeyPath);
      if (!this.checkIsEmpty(value)) {
        continue;
      }

      this.removedKeyPaths.push(valueKeyPath);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- We have no other way to delete the property.
      delete $object[key];
    }
  }
}

/**
 * Parses the front matter of a given content string.
 *
 * @typeParam CustomFrontmatter - The type of the custom front matter.
 * @param content - The content string to parse.
 * @returns The parsed front matter.
 */
export function parseFrontmatter<CustomFrontmatter = unknown>(content: string): CombinedFrontmatter<CustomFrontmatter> {
  const frontmatterInfo = getFrontMatterInfo(content);
  return (parseYaml(frontmatterInfo.frontmatter) ?? {}) as CombinedFrontmatter<CustomFrontmatter>;
}

/**
 * Removes the empty values from a front matter object, at any nesting depth.
 *
 * By default only empty strings are removed — both as property values and as array items. `null`, `undefined`, empty arrays and empty objects are kept unless the corresponding option is enabled.
 *
 * The object is modified in place, so the function can be called straight from a `processFrontmatter()` callback.
 *
 * @param params - The parameters for removing the empty front matter values.
 * @returns The dot-separated key paths of the removed values, in the order they were removed. An array item is reported by its index within the array as it was before any of its siblings were removed, e.g. `tags.0`.
 */
export function removeEmptyFrontmatterValues(params: RemoveEmptyFrontmatterValuesParams): string[] {
  return new EmptyFrontmatterValueRemover(params).remove(params.frontmatter);
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

  const newFrontmatterString = stringifyYaml(newFrontmatter);

  return frontmatterInfo.exists
    ? insertAt({
      $string: content,
      endIndex: frontmatterInfo.to,
      startIndex: frontmatterInfo.from,
      substring: newFrontmatterString
    })
    : `---\n${newFrontmatterString}---\n${content}`;
}

/**
 * Checks whether the value is a plain object, i.e. an object literal rather than an array or a class instance.
 *
 * `parseYaml()` turns a YAML timestamp into a {@link Date}, which has no own enumerable properties, so a plain `typeof value === 'object'` test would report every date as an empty object.
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
function checkIsPlainObject(value: unknown): value is GenericObject {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
