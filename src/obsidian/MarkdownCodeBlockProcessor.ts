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

import type { ValueProvider } from '../ValueProvider.ts';
import type { CodeBlockMarkdownInformation } from './CodeBlockMarkdownInformation.ts';

import { abortSignalAny } from '../AbortController.ts';
import {
  hasSingleOccurrence,
  indent,
  unindent
} from '../String.ts';
import { resolveValue } from '../ValueProvider.ts';
import {
  process,
  saveNote
} from './Vault.ts';

/**
 * Represents the options for getting the information about a code block in a Markdown section.
 */
export interface GetCodeBlockSectionInfoOptions {
  /**
   * An Obsidian app instance.
   */
  app: App;

  /**
   * A {@link MarkdownPostProcessorContext} object.
   */
  ctx: MarkdownPostProcessorContext;

  /**
   * A {@link HTMLElement} representing the code block.
   */
  el: HTMLElement;

  /**
   * A content of the note.
   */
  noteContent?: string;

  /**
   * A source of the code block.
   */
  source: string;
}

/**
 * Represents the options for inserting text after a code block.
 */
export interface InsertCodeBlockOptions extends GetCodeBlockSectionInfoOptions {
  /**
   * A number of lines to offset the insertion by. Default is `0`.
   */
  lineOffset?: number;

  /**
   * Whether to preserve the line prefix of the code block. Default is `false`.
   */
  shouldPreserveLinePrefix?: boolean;

  /**
   * A text to insert after the code block.
   */
  text: string;
}

/**
 * Represents the options for replacing a code block.
 */
export interface ReplaceCodeBlockOptions extends GetCodeBlockSectionInfoOptions {
  /**
   * An abort signal to control the execution of the function.
   */
  abortSignal?: AbortSignal;

  /**
   * Provides a new code block.
   */
  codeBlockProvider: ValueProvider<string, [string]>;

  /**
   * Whether to preserve the line prefix of the code block. Default is `false`.
   */
  shouldPreserveLinePrefix?: boolean;
}

/**
 * Gets the information about a code block in a Markdown section.
 *
 * @param options - The options for the function.
 * @returns The information about the code block in the Markdown section.
 */
export async function getCodeBlockMarkdownInfo(options: GetCodeBlockSectionInfoOptions): Promise<CodeBlockMarkdownInformation | null> {
  const { app, ctx, el, source } = options;

  const sourceFile = app.vault.getFileByPath(ctx.sourcePath);
  if (!sourceFile) {
    throw new Error(`Source file ${ctx.sourcePath} not found.`);
  }

  let content: string;
  if (options.noteContent) {
    content = options.noteContent;
  } else {
    await saveNote(app, sourceFile);
    content = await app.vault.read(sourceFile);
  }

  const approximateSectionInfo = ctx.getSectionInfo(el) ?? {
    lineEnd: content.split('\n').length - 1,
    lineStart: 0,
    text: content
  };

  if (!hasSingleOccurrence(content, approximateSectionInfo.text)) {
    return null;
  }

  const sectionOffset = content.indexOf(approximateSectionInfo.text);
  const linesBeforeSectionCount = content.slice(0, sectionOffset).split('\n').length - 1;

  const isInCallout = !!el.parentElement?.classList.contains('callout-content');

  const language = getLanguageFromElement(el);
  const sourceLines = source.split('\n');

  const textLines = approximateSectionInfo.text.split('\n');
  const textLineOffsets = new Map<number, number>();
  textLineOffsets.set(linesBeforeSectionCount, sectionOffset);

  let lastTextLineOffset = sectionOffset;
  for (let i = 0; i < textLines.length; i++) {
    const textLine = textLines[i];
    const line = textLine ?? '';
    const lineOffset = lastTextLineOffset + line.length + 1;
    textLineOffsets.set(linesBeforeSectionCount + i + 1, lineOffset);
    lastTextLineOffset = lineOffset;
  }

  const potentialCodeBlockTextLines = textLines.map((line, index) =>
    approximateSectionInfo.lineStart <= index && index <= approximateSectionInfo.lineEnd ? line : ''
  );
  const potentialCodeBlockText = potentialCodeBlockTextLines.join('\n');

  const REG_EXP =
    /(?<=^|\n)(?<LinePrefix> {0,3}(?:> {1,3})*)(?<CodeBlockStartDelimiter>(?<CodeBlockStartDelimiterChar>[`~])(?:\k<CodeBlockStartDelimiterChar>{2,}))(?<CodeBlockLanguage>\S*)(?:[ \t](?<CodeBlockArgs>.*?))?(?:\n(?<CodeBlockContent>(?:\n?\k<LinePrefix>.*)+?))?\n\k<LinePrefix>(?<CodeBlockEndDelimiter>\k<CodeBlockStartDelimiter>\k<CodeBlockStartDelimiterChar>*)[ \t]*(?=\n|$)/g;

  let markdownInfo: CodeBlockMarkdownInformation | null = null;

  for (const match of potentialCodeBlockText.matchAll(REG_EXP)) {
    if (!isSuitableCodeBlock(match, language, source, isInCallout)) {
      continue;
    }

    if (markdownInfo) {
      return null;
    }

    markdownInfo = createMarkdownInfoFromMatch(potentialCodeBlockText, match, approximateSectionInfo, sourceLines, textLineOffsets, linesBeforeSectionCount);
  }

  if (!markdownInfo) {
    return null;
  }

  return markdownInfo;
}

/**
 * Inserts text after the code block.
 *
 * @param options - The options for the function.
 */
export async function insertAfterCodeBlock(options: InsertCodeBlockOptions): Promise<void> {
  const { app, ctx, lineOffset = 0, text } = options;

  await process(app, ctx.sourcePath, async (_abortSignal, content) => {
    const markdownInfo = await getCodeBlockMarkdownInfo({
      ...options,
      noteContent: content
    });
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    const insertLineIndex = markdownInfo.positionInNote.end.line + lineOffset + 1;
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

  await process(app, ctx.sourcePath, async (_abortSignal, content) => {
    const markdownInfo = await getCodeBlockMarkdownInfo({
      ...options,
      noteContent: content
    });
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    const insertLineIndex = markdownInfo.positionInNote.start.line - lineOffset;
    return insertText(content, insertLineIndex, text, options.shouldPreserveLinePrefix);
  });
}

/**
 * Removes the code block.
 *
 * @param options - The options for the function.
 */
export async function removeCodeBlock(options: GetCodeBlockSectionInfoOptions): Promise<void> {
  await replaceCodeBlock({
    ...options,
    codeBlockProvider: ''
  });
}

/**
 * Replaces the code block.
 *
 * @param options - The options for the function.
 */
export async function replaceCodeBlock(options: ReplaceCodeBlockOptions): Promise<void> {
  const { app, codeBlockProvider, ctx } = options;
  options.abortSignal?.throwIfAborted();

  await process(app, ctx.sourcePath, async (abortSignal, content) => {
    abortSignal = abortSignalAny(abortSignal, options.abortSignal);
    abortSignal.throwIfAborted();
    const markdownInfo = await getCodeBlockMarkdownInfo({
      ...options,
      noteContent: content
    });
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    let oldCodeBlock = content.slice(markdownInfo.positionInNote.start.offset, markdownInfo.positionInNote.end.offset);
    if (options.shouldPreserveLinePrefix) {
      oldCodeBlock = unindent(oldCodeBlock, markdownInfo.linePrefix);
    }

    let newCodeBlock = await resolveValue(codeBlockProvider, abortSignal, oldCodeBlock);
    if (newCodeBlock && options.shouldPreserveLinePrefix) {
      newCodeBlock = indent(newCodeBlock, markdownInfo.linePrefix);
    }

    const textBeforeCodeBlock = content.slice(0, markdownInfo.positionInNote.start.offset);
    const textAfterCodeBlock = content.slice(markdownInfo.positionInNote.end.offset);

    return `${appendNewLine(textBeforeCodeBlock)}${appendNewLine(newCodeBlock)}${textAfterCodeBlock}`;
  });
}

function appendNewLine(text: string): string {
  return text === '' ? '' : `${text}\n`;
}

function createMarkdownInfoFromMatch(
  potentialCodeBlockText: string,
  match: RegExpMatchArray,
  approximateSectionInfo: MarkdownSectionInformation,
  sourceLines: string[],
  textLineOffsets: Map<number, number>,
  linesBeforeSectionCount: number
): CodeBlockMarkdownInformation {
  const linePrefix = match.groups?.['LinePrefix'] ?? '';
  const codeBlockStartDelimiter = match.groups?.['CodeBlockStartDelimiter'] ?? '';
  const codeBlockEndDelimiter = match.groups?.['CodeBlockEndDelimiter'] ?? '';
  const codeBlockArgsStr = match.groups?.['CodeBlockArgs'] ?? '';
  const language = match.groups?.['CodeBlockLanguage'] ?? '';

  const previousText = potentialCodeBlockText.slice(0, match.index);
  const previousTextLinesCount = previousText.split('\n').length - 1;

  const startLine = linesBeforeSectionCount + previousTextLinesCount;
  const endLine = startLine + sourceLines.length + 1;

  return {
    args: codeBlockArgsStr.split(/\s+/).filter(Boolean),
    endDelimiter: codeBlockEndDelimiter,
    language,
    linePrefix,
    positionInNote: {
      end: {
        col: (textLineOffsets.get(endLine + 1) ?? 0) - (textLineOffsets.get(endLine) ?? 0) - 1,
        line: endLine,
        offset: (textLineOffsets.get(endLine + 1) ?? 0) - 1
      },
      start: {
        col: 0,
        line: startLine,
        offset: textLineOffsets.get(startLine) ?? 0
      }
    },
    rawArgsStr: codeBlockArgsStr,
    sectionInfo: {
      lineEnd: previousTextLinesCount + sourceLines.length + 1,
      lineStart: previousTextLinesCount,
      text: approximateSectionInfo.text
    },
    startDelimiter: codeBlockStartDelimiter
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
