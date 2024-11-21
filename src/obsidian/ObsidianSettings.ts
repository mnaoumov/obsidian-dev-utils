/**
 * @packageDocumentation
 * This module provides utility functions for working with Obsidian settings.
 */

import type { App } from 'obsidian';

/**
 * Retrieves whether to use relative links based on the Obsidian settings.
 * @param app - The Obsidian app instance.
 * @returns Whether to use relative links.
 */
export function shouldUseRelativeLinks(app: App): boolean {
  return app.vault.getConfig('newLinkFormat') === 'relative';
}

/**
 * Retrieves whether to use wikilinks based on the Obsidian settings.
 * @param app - The Obsidian app instance.
 * @returns Whether to use wikilinks.
 */
export function shouldUseWikilinks(app: App): boolean {
  return !app.vault.getConfig('useMarkdownLinks');
}
