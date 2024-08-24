/**
 * @packageDocumentation MarkdownCodeBlockProcessor
 * This module provides utility functions for processing code blocks in Obsidian.
 */

import type { MarkdownPostProcessorContext } from "obsidian";

/**
 * Retrieves the argument of a code block from the given MarkdownPostProcessorContext and HTMLElement.
 *
 * @param ctx - The MarkdownPostProcessorContext object.
 * @param el - The HTMLElement representing the code block.
 * @returns The argument of the code block as a string, or null if no argument is found.
 */
export function getCodeBlockArgument(ctx: MarkdownPostProcessorContext, el: HTMLElement): string | null {
  const sectionInfo = ctx.getSectionInfo(el);
  if (!sectionInfo) {
    return null;
  }
  const lines = sectionInfo.text.split("\n");
  const codeBlockHeader = lines[sectionInfo.lineStart]!;
  const match = codeBlockHeader.match(/^\`{3,}\S+\s+(.*)$/);
  if (!match) {
    return null;
  }
  return match[1]?.trim() ?? null;
}
