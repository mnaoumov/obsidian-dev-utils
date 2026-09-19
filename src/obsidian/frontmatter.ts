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
import type { ValueWrapper } from '../value-wrapper.ts';

import { filterInPlace } from '../array.ts';
import { printError } from '../error.ts';
import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { insertAt } from '../string.ts';

/**
 * A combined front matter of a document.
 * It is a union of custom front matter, Obsidian front matter, and additional properties.
 *
 * @typeParam CustomFrontmatter - The type of custom front matter.
 */
export type CombinedFrontmatter<CustomFrontmatter> = GenericObject<CustomFrontmatter & ObsidianFrontmatter>;

/**
 * A rewrite of a note's front matter that keeps the author's original formatting wherever the change does not reach it.
 *
 * It is handed the whole note and the front matter to write, and returns the whole new note — or `null` when it cannot be faithful, which hands the write back to {@link setFrontmatter}'s own parse-and-stringify path. Returning `null` is never an error: it is how the preserver guarantees it can only ever match or improve on that path, never do worse than it.
 *
 * @param content - The note to rewrite the front matter of.
 * @param newFrontmatter - The front matter to write.
 * @returns The new note, or `null` to let {@link setFrontmatter} write it instead.
 */
export type FrontmatterFormattingPreserver = (this: void, content: string, newFrontmatter: object) => null | string;

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

const FRONTMATTER_FORMATTING_PRESERVER_STATE_KEY = 'frontmatterFormattingPreserver';
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

    return checkIsPlainObject(value) ? Object.keys(value).length === 0 && this.shouldRemoveEmptyObjects : false;
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
 * Checks whether the value is a plain object, i.e. an object literal rather than an array or a class instance.
 *
 * `parseYaml()` turns a YAML timestamp into a {@link Date}, which has no own enumerable properties, so a plain `typeof value === 'object'` test would report every date as an empty object.
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
export function checkIsPlainObject(value: unknown): value is GenericObject {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
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
 * Registers the {@link FrontmatterFormattingPreserver} every front-matter write in this library routes through.
 *
 * There is at most one, shared by every plugin loaded in the same realm — like every other registration in this library it lives in the `globalThis.__obsidianDevUtils` bag — so a single call makes every write this library performs formatting-preserving, `processFrontmatter()` and `applyFileChanges()` included. Pass `null` to unregister.
 *
 * The preserver is NOT registered by default, and that is a bundle-size decision rather than a doubt about the engine: the one this library ships needs the `yaml` package's CST API, which Obsidian does not hand to plugins and which costs about 100 KB of a plugin's `main.js`. A plugin that wants it calls `enableFrontmatterFormattingPreservation()` from `obsidian-dev-utils/obsidian/frontmatter-formatting`, and pays for it only then.
 *
 * @param preserver - The preserver to route front-matter writes through, or `null` to unregister the current one.
 */
export function registerFrontmatterFormattingPreserver(preserver: FrontmatterFormattingPreserver | null): void {
  getFrontmatterFormattingPreserverWrapper().value = preserver;
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
 * When a {@link FrontmatterFormattingPreserver} is registered (see {@link registerFrontmatterFormattingPreserver}) the write goes through it first, so the parts of the block the change does not reach keep the bytes their author wrote — their comments, quoting, blank lines and indentation. Without one, and whenever the preserver reports it cannot be faithful, the whole block is parsed and written out again, which is what Obsidian's own `processFrontMatter()` does.
 *
 * @param content - The content string to set the front matter in.
 * @param newFrontmatter - The new front matter to set.
 * @returns The new content string with the front matter set.
 */
export function setFrontmatter(content: string, newFrontmatter: object): string {
  const preservedContent = preserveFormatting(content, newFrontmatter);
  if (preservedContent !== null) {
    return preservedContent;
  }

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

function getFrontmatterFormattingPreserverWrapper(): ValueWrapper<FrontmatterFormattingPreserver | null> {
  return getObsidianDevUtilsState<FrontmatterFormattingPreserver | null>(FRONTMATTER_FORMATTING_PRESERVER_STATE_KEY, null);
}

function preserveFormatting(content: string, newFrontmatter: object): null | string {
  const preserver = getFrontmatterFormattingPreserverWrapper().value;
  if (!preserver) {
    return null;
  }

  // A preserver can be supplied by any plugin, and this runs inside the write queue, where a throw wedges every write
  // behind it. So a broken preserver is reported and stepped around rather than allowed to take the write down.
  try {
    return preserver(content, newFrontmatter);
  } catch (error) {
    printError(new Error('The registered front matter formatting preserver threw. Falling back to rewriting the whole block.', { cause: error }));
    return null;
  }
}
