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
  hasSingleOccurrence,
  indent,
  replaceAll
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
 * Represents the options for getting the information about a code block in a Markdown section.
 */
export interface GetCodeBlockSectionInfoOptions {
  /**
   * The Obsidian App object.
   */
  app: App;

  /**
   * The MarkdownPostProcessorContext object.
   */
  ctx: MarkdownPostProcessorContext;

  /**
   * The HTMLElement representing the code block.
   */
  el: HTMLElement;

  /**
   * The source of the code block.
   */
  source: string;
}

/**
 * Represents the options for inserting text after a code block.
 */
export interface InsertCodeBlockOptions extends GetCodeBlockSectionInfoOptions {
  /**
   * The number of lines to offset the insertion by. Default is `0`.
   */
  lineOffset?: number;

  /**
   * Whether to preserve the line prefix of the code block. Default is `false`.
   */
  shouldPreserveLinePrefix?: boolean;

  /**
   * The text to insert after the code block.
   */
  text: string;
}

/**
 * Represents the options for replacing a code block.
 */
export interface ReplaceCodeBlockOptions extends GetCodeBlockSectionInfoOptions {
  /**
   * The abort signal to control the execution of the function.
   */
  abortSignal?: AbortSignal;

  /**
   * The provider that provides the new code block.
   */
  codeBlockProvider: ValueProvider<string, [string]>;
}

/**
 * Gets the information about a code block in a Markdown section.
 *
 * @param options - The options for the function.
 * @returns The information about the code block in the Markdown section.
 *
 * @throws If no suitable code block is found.
 * @throws If multiple suitable code blocks are found. Happens when the code block is in a callout. Caused by the bug in Obsidian: {@link https://forum.obsidian.md/t/bug-getsectioninfo-is-inaccurate-inside-callouts/104289}
 */
export async function getCodeBlockSectionInfo(options: GetCodeBlockSectionInfoOptions): Promise<CodeBlockMarkdownSectionInformation> {
  const { app, ctx, el, source } = options;

  const approximateSectionInfo = ctx.getSectionInfo(el) ?? await createApproximateSectionInfo(app, ctx);
  const isInCallout = !!el.parentElement?.classList.contains('callout-content');

  const language = getLanguageFromElement(el);
  const sourceLines = source.split('\n');

  const textLines = approximateSectionInfo.text.split('\n');
  const potentialCodeBlockTextLines = textLines.map((line, index) =>
    approximateSectionInfo.lineStart <= index && index <= approximateSectionInfo.lineEnd ? line : ''
  );
  const potentialCodeBlockText = potentialCodeBlockTextLines.join('\n');

  const REG_EXP =
    /(?<=^|\n)(?<LinePrefix> {0,3}(?:> {1,3})*)(?<CodeBlockStartDelimiter>(?<CodeBlockStartDelimiterChar>[`~])(?:\k<CodeBlockStartDelimiterChar>{2,}))(?<CodeBlockLanguage>\S*)(?:[ \t]+(?<CodeBlockArgs>.*?)[ \t]+)?(?:\n(?<CodeBlockContent>(?:\n?\k<LinePrefix>.*)+?))?\n\k<LinePrefix>(?<CodeBlockEndDelimiter>\k<CodeBlockStartDelimiter>\k<CodeBlockStartDelimiterChar>*)[ \t]*(?:\n|$)/g;

  let sectionInfo: CodeBlockMarkdownSectionInformation | null = null;

  for (const match of potentialCodeBlockText.matchAll(REG_EXP)) {
    if (!isSuitableCodeBlock(match, language, source, isInCallout)) {
      continue;
    }

    if (sectionInfo) {
      throw new Error('Multiple suitable code blocks found.');
    }

    sectionInfo = createSectionInfoFromMatch(potentialCodeBlockText, match, approximateSectionInfo, sourceLines);
  }

  if (!sectionInfo) {
    throw new Error('No suitable code block found.');
  }

  return sectionInfo;
}

/**
 * Inserts text after the code block.
 *
 * @param options - The options for the function.
 */
export async function insertAfterCodeBlock(options: InsertCodeBlockOptions): Promise<void> {
  const { app, ctx, lineOffset = 0, text } = options;

  const sectionInfo = await getCodeBlockSectionInfo(options);
  await process(app, ctx.sourcePath, (_abortSignal, content) => {
    if (!hasSingleOccurrence(content, sectionInfo.text)) {
      throw new Error('Multiple suitable code blocks found.');
    }

    const index = content.indexOf(sectionInfo.text);
    const textBeforeSection = content.slice(0, index);
    const linesBeforeSection = textBeforeSection.split('\n');
    const insertLineIndex = linesBeforeSection.length + sectionInfo.lineEnd + lineOffset;
    return insertText(content, insertLineIndex, text, options.shouldPreserveLinePrefix);
  });
}

/**
 * Inserts text before the code block.
 *
 * @param options - The options for the function.
 */
export async function insertBeforeCodeBlock(options: InsertCodeBlockOptions): Promise<void> {
  const { app, ctx, lineOffset = 0, text } = options;

  const sectionInfo = await getCodeBlockSectionInfo(options);
  await process(app, ctx.sourcePath, (_abortSignal, content) => {
    if (!hasSingleOccurrence(content, sectionInfo.text)) {
      throw new Error('Multiple suitable code blocks found.');
    }

    const index = content.indexOf(sectionInfo.text);
    const textBeforeSection = content.slice(0, index);
    const linesBeforeSection = textBeforeSection.split('\n');
    const insertLineIndex = linesBeforeSection.length + sectionInfo.lineStart - lineOffset - 1;
    return insertText(content, insertLineIndex, text, options.shouldPreserveLinePrefix);
  });
}

/**
 * Replaces the code block.
 *
 * @param options - The options for the function.
 */
export async function replaceCodeBlock(options: ReplaceCodeBlockOptions): Promise<void> {
  const { app, codeBlockProvider, ctx } = options;

  const abortSignal = options.abortSignal ?? abortSignalNever();
  abortSignal.throwIfAborted();

  const sectionInfo = await getCodeBlockSectionInfo(options);

  const lines = sectionInfo.text.split('\n');
  const textBeforeCodeBlock = lines.slice(0, sectionInfo.lineStart).join('\n');
  const oldCodeBlock = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join('\n');
  const textAfterCodeBlock = lines.slice(sectionInfo.lineEnd + 1).join('\n');
  const newCodeBlock = await resolveValue(codeBlockProvider, abortSignal, oldCodeBlock);
  abortSignal.throwIfAborted();

  const newSectionText = `${textBeforeCodeBlock}\n${newCodeBlock}${textAfterCodeBlock}`;
  await process(app, ctx.sourcePath, (_abortSignal, content) => {
    if (!hasSingleOccurrence(content, sectionInfo.text)) {
      throw new Error('Multiple suitable code blocks found.');
    }
    return replaceAll(content, sectionInfo.text, newSectionText);
  });
}

async function createApproximateSectionInfo(app: App, ctx: MarkdownPostProcessorContext): Promise<MarkdownSectionInformation> {
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
  potentialCodeBlockText: string,
  match: RegExpMatchArray,
  approximateSectionInfo: MarkdownSectionInformation,
  sourceLines: string[]
): CodeBlockMarkdownSectionInformation {
  const linePrefix = match.groups?.['LinePrefix'] ?? '';
  const codeBlockStartDelimiter = match.groups?.['CodeBlockStartDelimiter'] ?? '';
  const codeBlockEndDelimiter = match.groups?.['CodeBlockEndDelimiter'] ?? '';
  const codeBlockArgs = match.groups?.['CodeBlockArgs'] ?? '';
  const language = match.groups?.['CodeBlockLanguage'] ?? '';

  const previousText = potentialCodeBlockText.slice(0, match.index);
  const previousTextLines = previousText.split('\n');

  return {
    args: codeBlockArgs,
    endDelimiter: codeBlockEndDelimiter,
    language,
    lineEnd: previousTextLines.length + sourceLines.length,
    lineStart: previousTextLines.length - 1,
    prefix: linePrefix,
    startDelimiter: codeBlockStartDelimiter,
    text: approximateSectionInfo.text
  };
}

function getLanguageFromElement(el: HTMLElement): string {
  const BLOCK_LANGUAGE_PREFIX = 'block-language-';
  return Array.from(el.classList).find((cls) => cls.startsWith(BLOCK_LANGUAGE_PREFIX))?.slice(BLOCK_LANGUAGE_PREFIX.length) ?? '';
}

function insertText(content: string, insertLineIndex: number, text: string, shouldPreserveLinePrefix?: boolean): string {
  const lines = content.split('\n');
  const newLines = lines.slice();
  const textLines = text.split('\n');

  if (insertLineIndex < 0) {
    insertLineIndex = 0;
  }
  if (insertLineIndex > lines.length) {
    insertLineIndex = lines.length;
  }

  const PREFIX_LINE_REG_EXP = /^ {0,3}(?:> {1,3})*/g;
  const match = (lines[insertLineIndex] ?? '').match(PREFIX_LINE_REG_EXP);
  const linePrefix = match?.[0] ?? '';
  newLines.splice(insertLineIndex, 0, ...(shouldPreserveLinePrefix ? textLines.map((line) => indent(line, linePrefix)) : textLines));
  return newLines.join('\n');
}

function isSuitableCodeBlock(
  match: RegExpMatchArray,
  language: string,
  source: string,
  isInCallout: boolean
): boolean {
  const codeBlockLanguage = match.groups?.['CodeBlockLanguage'] ?? '';
  if (codeBlockLanguage !== language) {
    return false;
  }

  const linePrefix = match.groups?.['LinePrefix'] ?? '';

  if (isInCallout && !linePrefix.includes('> ')) {
    return false;
  }

  const codeBlockContent = match.groups?.['CodeBlockContent'] ?? '';
  const cleanCodeBlockContent = codeBlockContent.split('\n').map((line) => line.slice(linePrefix.length)).join('\n');

  return cleanCodeBlockContent === source;
}
