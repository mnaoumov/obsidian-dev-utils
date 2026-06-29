/**
 * @file
 *
 * Obsidian-specific HTML element helpers.
 *
 * Unlike the Obsidian-runtime-agnostic helpers in `src/html-element.ts`, these depend on
 * Obsidian-specific presentation — currently the `markdown-rendered` CSS class that styles rendered
 * markdown — so they live in the Obsidian layer and use Obsidian's `createEl` DOM augmentation.
 */

import { CssClass } from './css-class.ts';

/**
 * Appends a code block to the given DocumentFragment or HTMLElement, styled to match Obsidian's
 * rendered-markdown inline code.
 *
 * @param el - The DocumentFragment or HTMLElement to append the code block to.
 * @param code - The code to be displayed in the code block.
 */
export function appendCodeBlock(el: DocumentFragment | HTMLElement, code: string): void {
  el.createEl('strong', { cls: `${CssClass.MarkdownRendered} ${CssClass.Code}` }, (strong) => {
    strong.createEl('code', { text: code });
  });
}
