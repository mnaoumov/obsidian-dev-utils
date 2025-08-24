/**
 * @packageDocumentation
 *
 * This module provides a helper type for the information about a code block in a markdown file.
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
   * Arguments of the code block.
   */
  args: string[];

  /**
   * An end delimiter of the code block.
   */
  endDelimiter: string;

  /**
   * A language of the code block.
   */
  language: string;

  /**
   * A line prefix of each line of the code block.
   */
  linePrefix: string;

  /**
   * A position of the code block in the note.
   */
  positionInNote: Pos;

  /**
   * Raw arguments string of the code block.
   */
  rawArgsStr: string;

  /**
   * A section information of the code block.
   */
  sectionInfo: MarkdownSectionInformation;

  /**
   * A start delimiter of the code block.
   */
  startDelimiter: string;
}
