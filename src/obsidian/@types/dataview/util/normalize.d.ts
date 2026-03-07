import type {
  DateTime,
  Duration
} from 'luxon';
import type { Result } from '../api/result.d.ts';
import type { QuerySettings } from '../settings.d.ts';
/** Normalize a duration to all of the proper units. */
export declare function normalizeDuration(dur: Duration): Duration;
/** Strip the time components of a date time object. */
export declare function stripTime(dt: DateTime): DateTime;
/** Try to extract a YYYYMMDD date from a string. */
export declare function extractDate(str: string): DateTime | undefined;
/** Get the folder containing the given path (i.e., like computing 'path/..'). */
export declare function getParentFolder(path: string): string;
/** Get the file name for the file referenced in the given path, by stripping the parent folders. */
export declare function getFileName(path: string): string;
/** Get the "title" for a file, by stripping other parts of the path as well as the extension. */
export declare function getFileTitle(path: string): string;
/** Get the extension of a file from the file path. */
export declare function getExtension(path: string): string;
/** Parse all subtags out of the given tag. I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
export declare function extractSubtags(tag: string): string[];
/** Try calling the given function; on failure, return the error message.  */
export declare function tryOrPropogate<T>(func: () => Result<T, string>): Result<T, string>;
/** Try asynchronously calling the given function; on failure, return the error message. */
export declare function asyncTryOrPropogate<T>(func: () => Promise<Result<T, string>>): Promise<Result<T, string>>;
/**
 * Escape regex characters in a string.
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions.
 */
export declare function escapeRegex(str: string): string;
/** Convert an arbitrary variable name into something JS/query friendly. */
export declare function canonicalizeVarName(name: string): string;
/**
 * Normalizes the text in a header to be something that is actually linkable to. This mimics
 * how Obsidian does it's normalization, collapsing repeated spaces and stripping out control characters.
 */
export declare function normalizeHeaderForLink(header: string): string;
/** Render a DateTime in a minimal format to save space. */
export declare function renderMinimalDate(time: DateTime, settings: QuerySettings, locale: string): string;
/** Render a duration in a minimal format to save space. */
export declare function renderMinimalDuration(dur: Duration): string;
/** Determine if two sets are equal in contents. */
export declare function setsEqual<T>(first: Set<T>, second: Set<T>): boolean;
