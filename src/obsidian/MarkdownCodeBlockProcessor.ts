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
  ensureLfEndings,
  getLfNormalizedOffsetToOriginalOffsetMapper,
  hasSingleOccurrence,
  indent,
  unindent
} from '../String.ts';
import { resolveValue } from '../ValueProvider.ts';
import {
  invokeWithFileSystemLock,
  process,
  saveNote
} from './Vault.ts';

/**
 * Options for {@link getCodeBlockMarkdownInfo}.
 */
export interface GetCodeBlockMarkdownInfoOptions {
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
   * A source of the code block.
   */
  source: string;
}

/**
 * Options for {@link insertAfterCodeBlock} / {@link insertBeforeCodeBlock}.
 */
export interface InsertCodeBlockOptions extends GetCodeBlockMarkdownInfoOptions {
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
 * Options for {@link removeCodeBlock}.
 */
export interface RemoveCodeBlockOptions extends GetCodeBlockMarkdownInfoOptions {
  /**
   * Whether to keep the gap after removing the code block. Default is `false`.
   */
  shouldKeepGap?: boolean;
}

/**
 * Options for {@link replaceCodeBlock}.
 */
export interface ReplaceCodeBlockOptions extends GetCodeBlockMarkdownInfoOptions {
  /**
   * An abort signal to control the execution of the function.
   */
  abortSignal?: AbortSignal;

  /**
   * Provides a new code block.
   */
  codeBlockProvider: ValueProvider<string, [string]>;

  /**
   * Whether to keep the gap when the new code block is empty. Default is `false`.
   */
  shouldKeepGapWhenEmpty?: boolean;

  /**
   * Whether to preserve the line prefix of the code block. Default is `false`.
   */
  shouldPreserveLinePrefix?: boolean;
}

interface CreateMarkdownInfoFromMatchOptions {
  approximateSectionInfo: MarkdownSectionInformation;
  linesBeforeSectionCount: number;
  match: RegExpMatchArray;
  noteContent: string;
  potentialCodeBlockText: string;
  sourceLinesCount: number;
  textLineOffsets: Map<number, number>;
}

/**
 * Gets the information about a code block in a Markdown section.
 *
 * @param options - The options for the function.
 * @returns The information about the code block in the Markdown section.
 */
export async function getCodeBlockMarkdownInfo(options: GetCodeBlockMarkdownInfoOptions): Promise<CodeBlockMarkdownInformation | null> {
  const { app, ctx, el, source } = options;

  const sourceFile = app.vault.getFileByPath(ctx.sourcePath);
  if (!sourceFile) {
    throw new Error(`Source file ${ctx.sourcePath} not found.`);
  }

  await saveNote(app, sourceFile);

  let markdownInfo: CodeBlockMarkdownInformation | null = null;

  await invokeWithFileSystemLock(app, sourceFile, (noteContent) => {
    const noteContentLf = ensureLfEndings(noteContent);

    const approximateSectionInfo = ctx.getSectionInfo(el) ?? {
      lineEnd: noteContentLf.split('\n').length - 1,
      lineStart: 0,
      text: noteContentLf
    };

    approximateSectionInfo.text = ensureLfEndings(approximateSectionInfo.text);
    const sourceLf = ensureLfEndings(source);

    if (!hasSingleOccurrence(noteContentLf, approximateSectionInfo.text)) {
      return;
    }

    const sectionOffset = noteContentLf.indexOf(approximateSectionInfo.text);
    const linesBeforeSectionCount = noteContentLf.slice(0, sectionOffset).split('\n').length - 1;

    const isInCallout = !!el.parentElement?.classList.contains('callout-content');

    const language = getLanguageFromElement(el);
    const sourceLines = sourceLf.split('\n');

    const textLines = approximateSectionInfo.text.split('\n');
    const textLineOffsets = new Map<number, number>();
    textLineOffsets.set(linesBeforeSectionCount, sectionOffset);

    let lastTextLineOffset = sectionOffset;
    for (let i = 0; i < textLines.length; i++) {
      const textLine = textLines[i] ?? '';
      const lineOffset = lastTextLineOffset + textLine.length + 1;
      textLineOffsets.set(linesBeforeSectionCount + i + 1, lineOffset);
      lastTextLineOffset = lineOffset;
    }

    const potentialCodeBlockTextLines = textLines.map((line, index) =>
      approximateSectionInfo.lineStart <= index && index <= approximateSectionInfo.lineEnd ? line : ''
    );
    const potentialCodeBlockText = potentialCodeBlockTextLines.join('\n');

    const REG_EXP =
      /(?<=^|\n)(?<LinePrefix> {0,3}(?:> {1,3})*)(?<CodeBlockStartDelimiter>(?<CodeBlockStartDelimiterChar>[`~])(?:\k<CodeBlockStartDelimiterChar>{2,}))(?<CodeBlockLanguage>\S*)(?:[ \t](?<CodeBlockArgs>.*?))?(?:\n(?<CodeBlockContent>(?:\n?\k<LinePrefix>.*)+?))?\n\k<LinePrefix>(?<CodeBlockEndDelimiter>\k<CodeBlockStartDelimiter>\k<CodeBlockStartDelimiterChar>*)[ \t]*(?=\n|$)/g;

    for (const match of potentialCodeBlockText.matchAll(REG_EXP)) {
      if (!isSuitableCodeBlock(match, language, sourceLf, isInCallout)) {
        continue;
      }

      if (markdownInfo) {
        return;
      }

      markdownInfo = createMarkdownInfoFromMatch({
        approximateSectionInfo,
        linesBeforeSectionCount,
        match,
        noteContent,
        potentialCodeBlockText,
        sourceLinesCount: sourceLines.length,
        textLineOffsets
      });
    }

    if (!markdownInfo) {
      return;
    }

    if (noteContentLf === noteContent) {
      return;
    }

    const lfOffsetMapper = getLfNormalizedOffsetToOriginalOffsetMapper(noteContent);
    markdownInfo.positionInNote.start.offset = lfOffsetMapper(markdownInfo.positionInNote.start.offset);
    markdownInfo.positionInNote.end.offset = lfOffsetMapper(markdownInfo.positionInNote.end.offset);
  });

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
    const markdownInfo = await getCodeBlockMarkdownInfo(options);
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    if (content !== markdownInfo.noteContent) {
      return null;
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
    const markdownInfo = await getCodeBlockMarkdownInfo(options);
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    if (content !== markdownInfo.noteContent) {
      return null;
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
export async function removeCodeBlock(options: RemoveCodeBlockOptions): Promise<void> {
  await replaceCodeBlock({
    ...options,
    codeBlockProvider: '',
    shouldKeepGapWhenEmpty: options.shouldKeepGap ?? false
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
    const markdownInfo = await getCodeBlockMarkdownInfo(options);
    if (!markdownInfo) {
      throw new Error('Could not uniquely identify the code block.');
    }

    if (content !== markdownInfo.noteContent) {
      return null;
    }

    let oldCodeBlock = content.slice(markdownInfo.positionInNote.start.offset, markdownInfo.positionInNote.end.offset);
    if (options.shouldPreserveLinePrefix) {
      oldCodeBlock = unindent(oldCodeBlock, markdownInfo.linePrefix);
    }

    let newCodeBlock = await resolveValue(codeBlockProvider, abortSignal, oldCodeBlock);
    if ((newCodeBlock || options.shouldKeepGapWhenEmpty) && options.shouldPreserveLinePrefix) {
      newCodeBlock = indent(newCodeBlock, markdownInfo.linePrefix);
    }

    const textBeforeCodeBlock = content.slice(0, markdownInfo.positionInNote.start.offset);
    const textAfterCodeBlock = content.slice(markdownInfo.positionInNote.end.offset);

    if (newCodeBlock || options.shouldKeepGapWhenEmpty) {
      return `${textBeforeCodeBlock}${newCodeBlock}${textAfterCodeBlock}`;
    }

    if (!textBeforeCodeBlock && !textAfterCodeBlock) {
      return '';
    }

    if (textBeforeCodeBlock) {
      return `${textBeforeCodeBlock.slice(0, -1)}${textAfterCodeBlock}`;
    }

    return `${textBeforeCodeBlock}${textAfterCodeBlock.slice(1)}`;
  });
}

function createMarkdownInfoFromMatch(options: CreateMarkdownInfoFromMatchOptions): CodeBlockMarkdownInformation {
  const {
    approximateSectionInfo,
    linesBeforeSectionCount,
    match,
    noteContent,
    potentialCodeBlockText,
    sourceLinesCount,
    textLineOffsets
  } = options;

  const linePrefix = match.groups?.['LinePrefix'] ?? '';
  const codeBlockStartDelimiter = match.groups?.['CodeBlockStartDelimiter'] ?? '';
  const codeBlockEndDelimiter = match.groups?.['CodeBlockEndDelimiter'] ?? '';
  const codeBlockArgsStr = match.groups?.['CodeBlockArgs'] ?? '';
  const language = match.groups?.['CodeBlockLanguage'] ?? '';

  const previousText = potentialCodeBlockText.slice(0, match.index);
  const previousTextLinesCount = previousText.split('\n').length - 1;

  const startLine = linesBeforeSectionCount + previousTextLinesCount;
  const endLine = startLine + sourceLinesCount + 1;

  return {
    args: codeBlockArgsStr.split(/\s+/).filter(Boolean),
    endDelimiter: codeBlockEndDelimiter,
    language,
    linePrefix,
    noteContent,
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
      lineEnd: previousTextLinesCount + sourceLinesCount + 1,
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
  sourceLf: string,
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

  return cleanCodeBlockContent === sourceLf;
}
