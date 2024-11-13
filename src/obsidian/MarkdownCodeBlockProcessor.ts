/**
 * @packageDocumentation MarkdownCodeBlockProcessor
 * This module provides utility functions for processing code blocks in Obsidian.
 */

import type { MarkdownPostProcessorContext } from 'obsidian';

import { parse } from 'shell-quote';

import { throwExpression } from '../Error.ts';

/**
 * Retrieves the argument of a code block from the given MarkdownPostProcessorContext and HTMLElement.
 *
 * @param ctx - The MarkdownPostProcessorContext object.
 * @param el - The HTMLElement representing the code block.
 * @returns The argument of the code block as a string, or null if no argument is found.
 */
export function getCodeBlockArguments(ctx: MarkdownPostProcessorContext, el: HTMLElement): string[] {
  const sectionInfo = ctx.getSectionInfo(el);
  if (!sectionInfo) {
    return [];
  }
  const lines = sectionInfo.text.split('\n');
  const codeBlockHeader = lines[sectionInfo.lineStart] ?? throwExpression(new Error('Code block header not found'));
  const match = /^`{3,}\S+\s+(.*)$/.exec(codeBlockHeader);
  if (!match) {
    return [];
  }
  return parse(match[1] ?? '').map(String);
}
