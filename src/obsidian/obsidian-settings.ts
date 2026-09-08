/**
 * @file
 *
 * This module provides utility functions for working with Obsidian settings.
 */

import type { App } from 'obsidian';

import { assertNever } from '../type-guards.ts';

/**
 * A way an input decides whether it is spell-checked.
 *
 * The `spellcheck` attribute is the whole mechanism: Obsidian never calls Electron's
 * `setSpellCheckerEnabled`, it only sets the attribute per element. So `AlwaysOn` really does spell-check
 * with `Editor > Spellcheck` off, and what it invokes is Chromium's built-in checker.
 */
export enum SpellcheckMode {
  /**
   * Always spell-check the input, whatever `Editor > Spellcheck` says.
   */
  AlwaysOn = 'AlwaysOn',

  /**
   * Follow `Editor > Spellcheck`, the way Obsidian's own name-entry surfaces do — the inline note title,
   * the file explorer's inline rename, the properties fields.
   */
  FollowObsidianSetting = 'FollowObsidianSetting',

  /**
   * Never spell-check the input, whatever `Editor > Spellcheck` says.
   */
  Off = 'Off'
}

/**
 * A format of the new link.
 */
export type NewLinkFormat = 'absolute' | 'relative' | 'shortest';

/**
 * Retrieves whether to use relative links based on the Obsidian settings.
 *
 * @param app - The Obsidian app instance.
 * @returns Whether to use relative links.
 */
export function getNewLinkFormat(app: App): NewLinkFormat {
  return app.vault.getConfig('newLinkFormat') as NewLinkFormat;
}

/**
 * Retrieves whether the spellcheck is enabled based on the Obsidian settings.
 *
 * @param app - The Obsidian app instance.
 * @returns Whether the spellcheck is enabled.
 */
export function isSpellcheckEnabled(app: App): boolean {
  return Boolean(app.vault.getConfig('spellcheck'));
}

/**
 * Resolves a {@link SpellcheckMode} against the Obsidian settings.
 *
 * @param app - The Obsidian app instance.
 * @param spellcheckMode - The mode to resolve.
 * @returns Whether the input should be spell-checked.
 */
export function isSpellcheckEnabledForMode(app: App, spellcheckMode: SpellcheckMode): boolean {
  switch (spellcheckMode) {
    case SpellcheckMode.AlwaysOn: {
      return true;
    }
    case SpellcheckMode.FollowObsidianSetting: {
      return isSpellcheckEnabled(app);
    }
    case SpellcheckMode.Off: {
      return false;
    }
    default: {
      assertNever(spellcheckMode);
    }
  }
}

/**
 * Retrieves whether to use wikilinks based on the Obsidian settings.
 *
 * @param app - The Obsidian app instance.
 * @returns Whether to use wikilinks.
 */
export function shouldUseWikilinks(app: App): boolean {
  return !app.vault.getConfig('useMarkdownLinks');
}
