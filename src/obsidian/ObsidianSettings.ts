/**
 * @packageDocumentation
 *
 * This module provides utility functions for working with Obsidian settings.
 */

import type { App } from 'obsidian';

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
 * Retrieves whether to use wikilinks based on the Obsidian settings.
 *
 * @param app - The Obsidian app instance.
 * @returns Whether to use wikilinks.
 */
export function shouldUseWikilinks(app: App): boolean {
  return !app.vault.getConfig('useMarkdownLinks');
}
