/**
 * @packageDocumentation MarkdownCodeBlockProcessor
 * This module provides utility functions for processing code blocks in Obsidian.
 */

import type {
  App,
  MarkdownPostProcessorContext
} from 'obsidian';

import { parse } from 'shell-quote';

import type { ValueProvider } from '../ValueProvider.ts';

import { throwExpression } from '../Error.ts';
import { resolveValue } from '../ValueProvider.ts';
import { process } from './Vault.ts';

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

/**
 * Replaces the code block.
 *
 * @param app - The Obsidian App object.
 * @param ctx - The MarkdownPostProcessorContext object.
 * @param el - The HTMLElement representing the code block.
 * @param codeBlockProvider - The ValueProvider that provides the new code block.
 */
export async function replaceCodeBlock(app: App, ctx: MarkdownPostProcessorContext, el: HTMLElement, codeBlockProvider: ValueProvider<string, [string]>): Promise<void> {
  const sectionInfo = ctx.getSectionInfo(el);
  if (!sectionInfo) {
    return;
  }
  const lines = sectionInfo.text.split('\n');
  const prefix = lines.slice(0, sectionInfo.lineStart).join('\n');
  const oldCodeBlock = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join('\n');
  const suffix = lines.slice(sectionInfo.lineEnd + 1).join('\n');
  const newCodeBlock = await resolveValue(codeBlockProvider, oldCodeBlock);
  const newSectionText = prefix + '\n' + newCodeBlock + (newCodeBlock ? '\n' : '') + suffix;
  await process(app, ctx.sourcePath, (content) => content.replace(sectionInfo.text, newSectionText));
}
