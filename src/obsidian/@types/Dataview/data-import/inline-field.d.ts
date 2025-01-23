/** Parse inline fields and other embedded metadata in a line. */
import type { Literal } from '../data-model/value.d.ts';
/** A parsed inline field. */
export interface InlineField {
  /** The raw parsed key. */
  key: string;
  /** The raw value of the field. */
  value: string;
  /** The start column of the field. */
  start: number;
  /** The start column of the *value* for the field. */
  startValue: number;
  /** The end column of the field. */
  end: number;
  /** If this inline field was defined via a wrapping ('[' or '('), then the wrapping that was used. */
  wrapping?: string;
}
/** The wrapper characters that can be used to define an inline field. */
export declare const INLINE_FIELD_WRAPPERS: Readonly<Record<string, string>>;
/** Parse a textual inline field value into something we can work with. */
export declare function parseInlineValue(value: string): Literal;
/** Extracts inline fields of the form '[key:: value]' from a line of text. This is done in a relatively
 * "robust" way to avoid failing due to bad nesting or other interfering Markdown symbols:
 *
 * - Look for any wrappers ('[' and '(') in the line, trying to parse whatever comes after it as an inline key::.
 * - If successful, scan until you find a matching end bracket, and parse whatever remains as an inline value.
 */
export declare function extractInlineFields(line: string, includeTaskFields?: boolean): InlineField[];
/** Attempt to extract a full-line field (Key:: Value consuming the entire content line). */
export declare function extractFullLineField(text: string): InlineField | undefined;
export declare const CREATED_DATE_REGEX: RegExp;
export declare const DUE_DATE_REGEX: RegExp;
export declare const DONE_DATE_REGEX: RegExp;
export declare const SCHEDULED_DATE_REGEX: RegExp;
export declare const START_DATE_REGEX: RegExp;
export declare const EMOJI_REGEXES: {
  regex: RegExp;
  key: string;
}[];
/** Sets or replaces the value of an inline field; if the value is 'undefined', deletes the key. */
export declare function setInlineField(source: string, key: string, value?: string): string;
export declare function setEmojiShorthandCompletionField(source: string, value?: string): string;
