/**
 * @packageDocumentation
 *
 * This module provides utility functions for processing code blocks in Obsidian.
 */

import type {
  App,
  MarkdownPostProcessorContext,
  MarkdownSectionInformation
} from 'obsidian';

import { getFrontMatterInfo } from 'obsidian';

import type { ValueProvider } from '../ValueProvider.ts';

import { abortSignalNever } from '../AbortController.ts';
import {
  indent,
  replaceAll,
  unindent
} from '../String.ts';
import { resolveValue } from '../ValueProvider.ts';
import { process } from './Vault.ts';

/**
 * Represents the information about a code block in a Markdown section.
 */
export interface CodeBlockMarkdownSectionInformation extends MarkdownSectionInformation {
  /**
   * The arguments of the code block.
   */
  args: string;

  /**
   * The end delimiter of the code block.
   */
  endDelimiter: string;

  /**
   * The language of the code block.
   */
  language: string;

  /**
   * The prefix of the code block.
   */
  prefix: string;

  /**
   * The start delimiter of the code block.
   */
  startDelimiter: string;
}

/**
 * Gets the information about a code block in a Markdown section.
 *
 * @param app - The Obsidian App object.
 * @param source - The source of the code block.
 * @param el - The HTMLElement representing the code block.
 * @param ctx - The MarkdownPostProcessorContext object.
 * @returns The information about the code block in the Markdown section.
 */
export async function getCodeBlockSectionInfo(
  app: App,
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<CodeBlockMarkdownSectionInformation> {
  const parentSectionInfo = ctx.getSectionInfo(el) ?? await createParentSectionInfo(app, ctx);

  const language = getLanguageFromElement(el);
  const sourceLines = source.split('\n');

  const REG_EXP =
    /(?:^|\n)(?<LinePrefix> {0,3}(?:> {1,3})*)(?<CodeBlockStartDelimiter>(?<CodeBlockStartDelimiterChar>[`~])(?:\k<CodeBlockStartDelimiterChar>{2,}))(?<CodeBlockLanguage>\S*)(?:[ \t]+(?<CodeBlockArgs>.*?)[ \t]+)?\n(?<CodeBlockContent>(?:\n?\k<LinePrefix>.*)+?)\n\k<LinePrefix>(?<CodeBlockEndDelimiter>\k<CodeBlockStartDelimiter>\k<CodeBlockStartDelimiterChar>*)[ \t]*(?:\n|$)/g;

  let sectionInfo: CodeBlockMarkdownSectionInformation | null = null;

  for (const match of parentSectionInfo.text.matchAll(REG_EXP)) {
    if (!isSuitableCodeBlock(match, language, source)) {
      continue;
    }

    if (sectionInfo) {
      throw new Error('Multiple suitable code blocks found.');
    }

    sectionInfo = createSectionInfoFromMatch(match, parentSectionInfo, sourceLines);
  }

  if (!sectionInfo) {
    throw new Error('No suitable code block found.');
  }

  return sectionInfo;
}

/**
 * Replaces the code block.
 *
 * @param app - The Obsidian App object.
 * @param source - The source of the code block.
 * @param ctx - The MarkdownPostProcessorContext object.
 * @param el - The HTMLElement representing the code block.
 * @param codeBlockProvider - The ValueProvider that provides the new code block.
 * @param abortSignal - The abort signal to control the execution of the function.
 */
export async function replaceCodeBlock(
  app: App,
  source: string,
  ctx: MarkdownPostProcessorContext,
  el: HTMLElement,
  codeBlockProvider: ValueProvider<string, [string]>,
  abortSignal?: AbortSignal
): Promise<void> {
  abortSignal ??= abortSignalNever();
  abortSignal.throwIfAborted();

  const sectionInfo = await getCodeBlockSectionInfo(app, source, el, ctx);

  const lines = sectionInfo.text.split('\n');
  const textBeforeCodeBlock = lines.slice(0, sectionInfo.lineStart).join('\n');
  const oldCodeBlockPrefixed = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join('\n');
  const oldCodeBlock = unindent(oldCodeBlockPrefixed, sectionInfo.prefix, true);
  const textAfterCodeBlock = lines.slice(sectionInfo.lineEnd + 1).join('\n');
  const newCodeBlock = await resolveValue(codeBlockProvider, abortSignal, oldCodeBlock);
  abortSignal.throwIfAborted();
  const newCodeBlockWithPrefix = indent(newCodeBlock, sectionInfo.prefix);

  const newSectionText = `${textBeforeCodeBlock}\n${newCodeBlockWithPrefix}${newCodeBlockWithPrefix ? '\n' : ''}${textAfterCodeBlock}`;
  await process(app, ctx.sourcePath, (_abortSignal, content) => replaceAll(content, sectionInfo.text, newSectionText));
}

async function createParentSectionInfo(app: App, ctx: MarkdownPostProcessorContext): Promise<MarkdownSectionInformation> {
  const sourceFile = app.vault.getFileByPath(ctx.sourcePath);
  if (!sourceFile) {
    throw new Error(`Source file ${ctx.sourcePath} not found.`);
  }
  const cache = app.metadataCache.getFileCache(sourceFile);
  const frontmatterEndOffset = cache?.frontmatterPosition?.end.offset;
  const content = await app.vault.cachedRead(sourceFile);
  const contentStartOffset = frontmatterEndOffset === undefined ? getFrontMatterInfo(content).contentStart : frontmatterEndOffset + 1;
  const text = content.slice(contentStartOffset);
  return {
    lineEnd: text.split('\n').length - 1,
    lineStart: 0,
    text
  };
}

function createSectionInfoFromMatch(
  match: RegExpMatchArray,
  parentSectionInfo: MarkdownSectionInformation,
  sourceLines: string[]
): CodeBlockMarkdownSectionInformation {
  const linePrefix = match.groups?.['LinePrefix'] ?? '';
  const codeBlockStartDelimiter = match.groups?.['CodeBlockStartDelimiter'] ?? '';
  const codeBlockEndDelimiter = match.groups?.['CodeBlockEndDelimiter'] ?? '';
  const codeBlockArgs = match.groups?.['CodeBlockArgs'] ?? '';
  const language = match.groups?.['CodeBlockLanguage'] ?? '';

  const previousText = parentSectionInfo.text.slice(0, match.index);
  const previousTextLines = previousText.split('\n');

  return {
    ...parentSectionInfo,
    args: codeBlockArgs,
    endDelimiter: codeBlockEndDelimiter,
    language,
    lineEnd: parentSectionInfo.lineStart + previousTextLines.length + sourceLines.length + 1,
    lineStart: parentSectionInfo.lineStart + previousTextLines.length,
    prefix: linePrefix,
    startDelimiter: codeBlockStartDelimiter,
    text: match[0]
  };
}

function getLanguageFromElement(el: HTMLElement): string {
  const BLOCK_LANGUAGE_PREFIX = 'block-language-';
  return Array.from(el.classList).find((cls) => cls.startsWith(BLOCK_LANGUAGE_PREFIX))?.slice(BLOCK_LANGUAGE_PREFIX.length) ?? '';
}

function isSuitableCodeBlock(
  match: RegExpMatchArray,
  language: string,
  source: string
): boolean {
  const codeBlockLanguage = match.groups?.['CodeBlockLanguage'] ?? '';
  if (codeBlockLanguage !== language) {
    return false;
  }

  const linePrefix = match.groups?.['LinePrefix'] ?? '';
  const codeBlockContent = match.groups?.['CodeBlockContent'] ?? '';
  const cleanCodeBlockContent = codeBlockContent.split('\n').map((line) => line.slice(linePrefix.length)).join('\n');

  return cleanCodeBlockContent === source;
}
