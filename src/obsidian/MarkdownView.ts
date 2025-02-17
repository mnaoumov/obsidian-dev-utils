/**
 * @packageDocumentation MarkdownView
 * Utilities for working with MarkdownView
 */

import type { MarkdownView } from 'obsidian';

/**
 * Get the full HTML content of the current MarkdownView
 *
 * @param view - The MarkdownView to get the HTML from
 * @returns The full HTML of the MarkdownView
 */
export function getFullContentHtml(view: MarkdownView): string {
  const codeMirror = view.editor.cm;
  codeMirror.viewState.printing = true;
  codeMirror.measure();
  const html = view.contentEl.innerHTML;
  codeMirror.viewState.printing = false;
  codeMirror.measure();
  return html;
}
