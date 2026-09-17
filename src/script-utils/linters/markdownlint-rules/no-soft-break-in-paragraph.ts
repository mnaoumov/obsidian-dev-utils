/**
 * @file
 *
 * markdownlint rule: `no-soft-break-in-paragraph`.
 *
 * Reports every soft line break inside a paragraph. A bare newline there is CommonMark's *soft line
 * break*: it renders as a single space, so `line1\nline2` and `line1 line2` are the same document. The
 * wrapping therefore encodes nothing, while costing a reflowed diff on every one-word edit and defeating
 * any search whose phrase straddles the break.
 *
 * The check is syntactic rather than heuristic — a `lineEnding` token that micromark places inside a
 * `paragraph` token — which is what makes it cheap and exact. The exemptions fall out of the token types
 * instead of being special-cased: fenced and indented code, math blocks, tables, headings and YAML front
 * matter are not `paragraph` tokens, so they are never reached. The one exemption that does NOT fall out
 * of a token type is the callout marker line, which CommonMark has no construct for — see
 * `CALLOUT_MARKER_LINE_REG_EXP`.
 *
 * No built-in markdownlint rule covers this, and none can: the library ships nothing optional, everything
 * in it is on by default, and a rule requiring the long line contradicts `MD013`, which caps it.
 */

import type {
  MicromarkToken,
  Rule,
  RuleOnError,
  RuleParams
} from 'markdownlint';

/**
 * The rule's name, as it is spelled in a `markdownlint-cli2` configuration.
 */
export const NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME = 'no-soft-break-in-paragraph';

/**
 * Matches the `htmlText` token of an HTML line break, in each of the spellings CommonMark accepts.
 */
const BR_HTML_TEXT_REG_EXP = /^<br\s*\/?>$/i;

/**
 * Matches the MARKER line of a callout / GitHub alert — `> [!NOTE]`, with an optional title after the
 * marker, an optional foldable `-` / `+` suffix, and any depth of blockquote nesting.
 *
 * The break at the end of such a line is load-bearing, in the same class as `<br>` and a trailing `\`,
 * and this is the one exemption the token types cannot supply. CommonMark has no callout construct, so
 * micromark parses the marker and its body as ONE blockquote paragraph, indistinguishable from an
 * ordinary wrapped one. Both renderers this library ships to implement an extension over that, and both
 * BREAK when the marker's newline is joined: GitHub requires the `[!TYPE]` alone on its first line and
 * otherwise renders a literal blockquote containing the text `[!NOTE] …`, while Obsidian reads
 * everything after the marker as the callout's TITLE, so the whole body becomes one heading.
 *
 * Neither difference is visible to a CommonMark render comparison, which is the obvious way to verify an
 * unwrap — so reporting the marker line is a false positive whose fix silently damages the document, and
 * the damage survives the check most likely to be run against it.
 *
 * Only the marker line is protected. The callout's BODY lines wrap like any other paragraph and are
 * reported as usual.
 */
const CALLOUT_MARKER_LINE_REG_EXP = /^[ \t]*>[ \t]*(?:>[ \t]*)*\[![A-Za-z][\w-]*\][-+]?/;

/**
 * The tokens micromark emits for the two line breaks CommonMark makes EXPLICIT, each of which precedes a
 * perfectly ordinary `lineEnding` inside the paragraph. Without this the sanctioned escape hatch would
 * read as a violation.
 *
 * Both entries are load-bearing, `hardBreakEscape` included: a trailing `\` is NOT folded into the
 * preceding `data` token, it becomes its own token followed by a `lineEnding`, exactly as two trailing
 * spaces do (verified against `markdownlint@0.41.1`).
 *
 * Two trailing spaces are excluded here rather than endorsed — `MD009` (no trailing spaces) already owns
 * that shape, and one defect deserves one finding.
 */
const EXPLICIT_BREAK_TOKEN_TYPES = new Set<string>([
  'hardBreakEscape',
  'hardBreakTrailing'
]);

/**
 * Blocks whose own line structure IS the content, and which must not be descended into.
 *
 * `htmlFlow` is the one that matters, and it is a real false positive rather than insurance: markdownlint's
 * micromark re-parses an HTML block so its inline rules can reach the text, which nests a `content` /
 * `paragraph` pair inside the block — so every newline in a multi-line `<div>` or `<details>` wrapper is a
 * `lineEnding` inside a `paragraph`. (Not every HTML block takes that shape: a `<!-- … -->` comment yields
 * `htmlFlowData` instead, with no paragraph. Skipping the block answers both.)
 *
 * The other three are insurance. Today they emit no nested paragraph, so nothing descends into them
 * anyway; they are named because they are the same class of block, and one `Set` entry each is cheaper
 * than rediscovering why a future parser change started reporting code.
 */
const LITERAL_FLOW_TOKEN_TYPES = new Set<string>([
  'codeFenced',
  'codeIndented',
  'htmlFlow',
  'mathFlow'
]);

/**
 * The remedy, attached to every finding, because there is no published documentation URL to point at.
 */
const ERROR_DETAIL = 'Put the whole paragraph on one line, or make the break explicit with a trailing `\\` or `<br>`';

/**
 * The micromark token type of a line break.
 */
const LINE_ENDING_TOKEN_TYPE = 'lineEnding';

/**
 * The micromark token type that a soft break has to be inside of to count.
 */
const PARAGRAPH_TOKEN_TYPE = 'paragraph';

/**
 * The micromark token type of raw inline HTML.
 */
const HTML_TEXT_TOKEN_TYPE = 'htmlText';

/**
 * The parameters of {@link reportSoftBreaks}.
 */
interface ReportSoftBreaksParams {
  /**
   * The line numbers of the document's callout marker lines, whose breaks are load-bearing.
   */
  readonly calloutMarkerLineNumbers: ReadonlySet<number>;

  /**
   * Whether these tokens are inside a `paragraph` token.
   */
  readonly isInParagraph: boolean;

  /**
   * The markdownlint error-reporting callback.
   */
  readonly onError: RuleOnError;

  /**
   * The sibling tokens to walk.
   */
  readonly tokens: readonly MicromarkToken[];
}

/**
 * Checks whether a `lineEnding` is preceded by one of the breaks CommonMark makes explicit, which this
 * rule deliberately permits.
 *
 * @param previousToken - The token immediately before the `lineEnding`, or `undefined` when the
 * `lineEnding` is its parent's first child. That happens for real input — `[\nalpha](url)` puts one at the
 * start of the link's `labelText` — and such a break is a violation like any other.
 * @returns `true` if the break is explicit.
 */
function checkIsExplicitBreak(previousToken: MicromarkToken | undefined): boolean {
  if (!previousToken) {
    return false;
  }

  return EXPLICIT_BREAK_TOKEN_TYPES.has(previousToken.type) ? true : previousToken.type === HTML_TEXT_TOKEN_TYPE && BR_HTML_TEXT_REG_EXP.test(previousToken.text);
}

/**
 * Collects the line numbers of every callout marker line in the document.
 *
 * Scanning the lines once up front is what keeps the exemption a set membership test at the report site,
 * rather than a regex run against a re-derived line for every `lineEnding` in the file.
 *
 * @param lines - The document's lines, as markdownlint supplies them: front matter already stripped, so
 * the numbers collected here index the same way a token's `startLine` does.
 * @returns The 1-based numbers of the lines that are callout markers.
 */
function findCalloutMarkerLineNumbers(lines: readonly string[]): ReadonlySet<number> {
  const calloutMarkerLineNumbers = new Set<number>();

  for (const [index, line] of lines.entries()) {
    if (CALLOUT_MARKER_LINE_REG_EXP.test(line)) {
      calloutMarkerLineNumbers.add(index + 1);
    }
  }

  return calloutMarkerLineNumbers;
}

/**
 * Walks a token list, reporting every soft line break that falls inside a paragraph.
 *
 * @param params - The walk's parameters.
 */
function reportSoftBreaks(params: ReportSoftBreaksParams): void {
  for (const [index, token] of params.tokens.entries()) {
    if (LITERAL_FLOW_TOKEN_TYPES.has(token.type)) {
      continue;
    }

    if (
      params.isInParagraph
      && token.type === LINE_ENDING_TOKEN_TYPE
      && !checkIsExplicitBreak(params.tokens[index - 1])
      && !params.calloutMarkerLineNumbers.has(token.startLine)
    ) {
      params.onError({
        detail: ERROR_DETAIL,
        lineNumber: token.startLine
      });
    }

    reportSoftBreaks({
      calloutMarkerLineNumbers: params.calloutMarkerLineNumbers,
      isInParagraph: params.isInParagraph || token.type === PARAGRAPH_TOKEN_TYPE,
      onError: params.onError,
      tokens: token.children
    });
  }
}

/**
 * A markdownlint rule forbidding a soft line break inside a paragraph, i.e. a hard-wrapped paragraph.
 *
 * It carries no `fixInfo`, and cannot: `applyFix` rewrites ONE line and `RuleOnErrorInfo` carries one fix
 * per error, so joining two lines needs two edits on two lines — which is two errors, and the last line of
 * a paragraph has no soft break to hang the second one on. Unwrapping in bulk stays a job for a purpose-
 * built script; this rule's job is to stop new wrapping arriving.
 */
export const noSoftBreakInParagraphRule: Rule = {
  description: 'Paragraph is hard-wrapped (soft line break inside a paragraph)',
  function: (params: RuleParams, onError: RuleOnError): void => {
    reportSoftBreaks({
      calloutMarkerLineNumbers: findCalloutMarkerLineNumbers(params.lines),
      isInParagraph: false,
      onError,
      tokens: params.parsers.micromark.tokens
    });
  },
  names: [NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME],
  parser: 'micromark',
  tags: ['paragraphs', 'whitespace']
};
