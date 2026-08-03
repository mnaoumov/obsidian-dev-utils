/**
 * @file
 *
 * This module provides classes and validators for managing include/exclude path settings.
 */

import type { MaybeReturn } from '../type.ts';

import {
  ALWAYS_MATCH_REG_EXP,
  escapeRegExp,
  isValidRegExp,
  NEVER_MATCH_REG_EXP
} from '../reg-exp.ts';
import { trimEnd } from '../string.ts';
import { assertNever } from '../type-guards.ts';
import { t } from './i18n/i18n.ts';

enum PathSettingType {
  Exclude = 'Exclude',
  Include = 'Include'
}

class PathSetting {
  public get array(): string[] {
    return this._array;
  }

  public set array(value: string[]) {
    this._array = value.filter(Boolean);
    this.regExp = makeRegExp(this._array, this.defaultRegExp) ?? this.defaultRegExp;
  }

  private _array: string[] = [];
  private readonly defaultRegExp: RegExp;
  private regExp: RegExp;

  public constructor(private readonly type: PathSettingType) {
    this.defaultRegExp = getDefaultRegExp(type);
    this.regExp = this.defaultRegExp;
  }

  public isPathIgnored(path: string): boolean {
    /* v8 ignore start -- All branches covered but v8 reports switch as partial. */
    switch (this.type) {
      /* v8 ignore stop */
      case PathSettingType.Exclude: {
        return this.regExp.test(path);
      }
      case PathSettingType.Include: {
        return !this.regExp.test(path);
      }
      default: {
        /* v8 ignore start -- Exhaustive switch guard. */
        assertNever(this.type);
      }
        /* v8 ignore stop */
    }
  }
}

/**
 * A class for managing include/exclude path settings.
 */
export class PathSettings {
  /**
   * Gets the exclude paths.
   *
   * @returns The exclude paths.
   */
  public get excludePaths(): string[] {
    return this._excludePaths.array;
  }

  /**
   * Sets the exclude paths.
   *
   * @param value - The exclude paths.
   */
  public set excludePaths(value: string[]) {
    this._excludePaths.array = value;
  }

  /**
   * Gets the include paths.
   *
   * @returns The include paths.
   */
  public get includePaths(): string[] {
    return this._includePaths.array;
  }

  /**
   * Sets the include paths.
   *
   * @param value - The include paths.
   */
  public set includePaths(value: string[]) {
    this._includePaths.array = value;
  }

  private readonly _excludePaths = new PathSetting(PathSettingType.Exclude);
  private readonly _includePaths = new PathSetting(PathSettingType.Include);

  /**
   * Checks if a path is ignored by the include/exclude path settings.
   *
   * @param path - The path to check.
   * @returns `true` if the path is ignored, `false` otherwise.
   */
  public isPathIgnored(path: string): boolean {
    return this._includePaths.isPathIgnored(path) || this._excludePaths.isPathIgnored(path);
  }
}

/**
 * Validates include/exclude path entries, reporting the first entry that is not a parseable regular expression.
 *
 * An entry that starts and ends with `/` is a regular expression literal; every other entry is a plain path and is
 * always valid. An invalid entry does not throw when assigned to {@link PathSettings} — the whole list falls back to
 * its default pattern instead — so this validator is what surfaces the problem to the user.
 *
 * @param paths - The path entries to validate.
 * @returns A message naming the first invalid entry, or nothing when every entry is valid.
 */
export function pathsValidator(paths: string[]): MaybeReturn<string> {
  for (const path of paths) {
    if (path.startsWith('/') && path.endsWith('/') && !isValidRegExp(path.slice(1, -1))) {
      return t(($) => $.obsidianDevUtils.pathSettings.invalidRegularExpression, { regExp: path });
    }
  }
}

function getDefaultRegExp(type: PathSettingType): RegExp {
  /* v8 ignore start -- All branches covered but v8 reports switch as partial. */
  switch (type) {
    /* v8 ignore stop */
    case PathSettingType.Exclude: {
      return NEVER_MATCH_REG_EXP;
    }
    case PathSettingType.Include: {
      return ALWAYS_MATCH_REG_EXP;
    }
    default: {
      /* v8 ignore start -- Exhaustive switch guard. */
      assertNever(type);
    }
      /* v8 ignore stop */
  }
}

function makeRegExp(paths: string[], defaultRegExp: RegExp): null | RegExp {
  if (paths.length === 0) {
    return defaultRegExp;
  }

  const regExpStringCombined = paths.map((path) => {
    if (path === '/') {
      return defaultRegExp.source;
    }

    if (path.startsWith('/') && path.endsWith('/')) {
      return path.slice(1, -1);
    }

    path = trimEnd({
      $string: path,
      suffix: '/'
    });
    return `^${escapeRegExp(path)}(/|$)`;
  })
    .map((regExpString) => `(${regExpString})`)
    .join('|');

  try {
    return new RegExp(regExpStringCombined);
  } catch {
    // A partially typed regex literal (`/^Inbox\/`) is not parseable.
    // Report it instead of throwing from a settings setter, which would break both the settings UI and the save path.
    return null;
  }
}
