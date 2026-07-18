/**
 * @file
 *
 * Provides the regular expression used to locate fenced code blocks within a Markdown note, including
 * blocks nested inside callouts of any depth.
 */

/**
 * Creates a regular expression that matches a single fenced code block anywhere in a Markdown note.
 *
 * A fresh instance is returned on each call so callers may safely use stateful methods (e.g.
 * {@link RegExp.exec}) without sharing `lastIndex` between scans.
 *
 * Named capture groups:
 * - `LinePrefix` — the leading indentation / callout blockquote prefix (`> ` repeated once per nesting
 *   level) shared by every line of the block.
 * - `CodeBlockStartDelimiter` / `CodeBlockStartDelimiterChar` — the opening fence (3+ backticks or tildes)
 *   and the fence character.
 * - `CodeBlockLanguage` — the info-string language token immediately after the opening fence.
 * - `CodeBlockArgs` — any extra arguments after the language token.
 * - `CodeBlockContent` — the block body. Each content line carries the same `LinePrefix`.
 * - `CodeBlockEndDelimiter` — the closing fence.
 *
 * The `CodeBlockContent` group is written as `\k<LinePrefix>.*(?:\n\k<LinePrefix>.*)*?` — a first line
 * followed by zero or more lines each introduced by a **mandatory** newline. This deliberately avoids the
 * ambiguous `(?:\n?\k<LinePrefix>.*)+?` form (optional newline + repeatable line remainder), which lets a
 * single line be partitioned in exponentially many ways and causes catastrophic backtracking — a
 * synchronous freeze — when the scan meets a fence-open with no valid closing fence before the end of the
 * note. The mandatory-newline form matches the same text linearly.
 *
 * @returns A fresh global {@link RegExp} matching one fenced code block.
 */
export function createCodeBlockRegExp(): RegExp {
  return /(?<=^|\n)(?<LinePrefix> {0,3}(?:> {1,3})*)(?<CodeBlockStartDelimiter>(?<CodeBlockStartDelimiterChar>[`~])(?:\k<CodeBlockStartDelimiterChar>{2,}))(?<CodeBlockLanguage>\S*)(?:[ \t](?<CodeBlockArgs>.*?))?(?:\n(?<CodeBlockContent>\k<LinePrefix>.*(?:\n\k<LinePrefix>.*)*?))?\n\k<LinePrefix>(?<CodeBlockEndDelimiter>\k<CodeBlockStartDelimiter>\k<CodeBlockStartDelimiterChar>*)[ \t]*(?=\n|$)/g;
}
