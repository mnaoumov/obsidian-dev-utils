/**
 * @packageDocumentation Markdown
 * This module provides utility functions for processing Markdown content in Obsidian.
 */

import {
  App,
  Component,
  MarkdownRenderer
} from 'obsidian';

/**
 * Converts Markdown to HTML.
 *
 * @param app - The Obsidian app instance.
 * @param markdown - The Markdown string to convert.
 * @param sourcePath - (optional) The source path to resolve relative links.
 * @returns The HTML string.
 */
export async function markdownToHtml(app: App, markdown: string, sourcePath?: string): Promise<string> {
  const component = new Component();
  component.load();
  const renderDiv = createDiv();
  await MarkdownRenderer.render(app, markdown, renderDiv, sourcePath ?? '', component);
  const html = renderDiv.innerHTML;
  component.unload();
  return html;
}
