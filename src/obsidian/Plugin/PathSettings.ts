/**
 * @packageDocumentation
 *
 * This module provides classes for managing include/exclude path settings.
 */

import {
  ALWAYS_MATCH_REG_EXP,
  escapeRegExp,
  NEVER_MATCH_REG_EXP
} from '../../RegExp.ts';
import { trimEnd } from '../../String.ts';

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
    this.regExp = makeRegExp(this._array, this.defaultRegExp);
  }

  private _array: string[] = [];
  private readonly defaultRegExp: RegExp;
  private regExp: RegExp;

  public constructor(private readonly type: PathSettingType) {
    this.defaultRegExp = getDefaultRegExp(type);
    this.regExp = this.defaultRegExp;
  }

  public isPathIgnored(path: string): boolean {
    switch (this.type) {
      case PathSettingType.Exclude:
        return this.regExp.test(path);
      case PathSettingType.Include:
        return !this.regExp.test(path);
      default:
        throw new Error(`Invalid path setting type: ${this.type as string}`);
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
   * @returns True if the path is ignored, false otherwise.
   */
  public isPathIgnored(path: string): boolean {
    return this._includePaths.isPathIgnored(path) || this._excludePaths.isPathIgnored(path);
  }
}

function getDefaultRegExp(type: PathSettingType): RegExp {
  switch (type) {
    case PathSettingType.Exclude:
      return NEVER_MATCH_REG_EXP;
    case PathSettingType.Include:
      return ALWAYS_MATCH_REG_EXP;
    default:
      throw new Error(`Invalid path setting type: ${type as string}`);
  }
}

function makeRegExp(paths: string[], defaultRegExp: RegExp): RegExp {
  if (paths.length === 0) {
    return defaultRegExp;
  }

  const regExpStrCombined = paths.map((path) => {
    if (path === '/') {
      return defaultRegExp.source;
    }

    if (path.startsWith('/') && path.endsWith('/')) {
      return path.slice(1, -1);
    }

    path = trimEnd(path, '/');
    return `^${escapeRegExp(path)}(/|$)`;
  })
    .map((regExpStr) => `(${regExpStr})`)
    .join('|');
  return new RegExp(regExpStrCombined);
}
