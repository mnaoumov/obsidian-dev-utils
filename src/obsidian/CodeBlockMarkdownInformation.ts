/**
 * @packageDocumentation
 *
 * The module provides a helper type for the information about a code block in a markdown file.
 */

import type {
  MarkdownSectionInformation,
  Pos
} from 'obsidian';

/**
 * Information about a code block in a markdown file.
 */
export interface CodeBlockMarkdownInformation {
  /**
   * The arguments of the code block.
   */
  args: string[];

  /**
   * The end delimiter of the code block.
   */
  endDelimiter: string;

  /**
   * The language of the code block.
   */
  language: string;

  /**
   * The line prefix of each line of the code block.
   */
  linePrefix: string;

  /**
   * The position of the code block in the note.
   */
  positionInNote: Pos;

  /**
   * The raw arguments string of the code block.
   */
  rawArgsStr: string;

  /**
   * The section information of the code block.
   */
  sectionInfo: MarkdownSectionInformation;

  /**
   * The start delimiter of the code block.
   */
  startDelimiter: string;
}
