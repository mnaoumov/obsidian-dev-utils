/**
 * @packageDocumentation DocumentFragment
 * This module provides utility functions for working with DocumentFragments.
 */

/**
 * Appends a code block to the given DocumentFragment.
 *
 * @param fragment - The DocumentFragment to append the code block to.
 * @param code - The code to be displayed in the code block.
 */
export function appendCodeBlock(fragment: DocumentFragment, code: string): void {
  fragment.appendChild(createSpan({ cls: "markdown-rendered code" }, (span) => {
    span.style.fontWeight = "bold";
    span.appendChild(createEl("code", { text: code }));
  }));
}
