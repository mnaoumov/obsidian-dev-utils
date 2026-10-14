import { lint } from 'markdownlint/promise';
import {
  describe,
  expect,
  it
} from 'vitest';

import { obsidianDevUtilsConfig } from '../markdownlint-cli2-config.ts';
import {
  NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME,
  noSoftBreakInParagraphRule
} from './no-soft-break-in-paragraph.ts';

const FILE_NAME = 'fixture.md';

async function getReportedLineNumbers(markdown: string): Promise<number[]> {
  const results = await lint({
    config: {
      default: false,
      [NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME]: true
    },
    customRules: [noSoftBreakInParagraphRule],
    strings: {
      [FILE_NAME]: markdown
    }
  });

  return (results[FILE_NAME] ?? []).map((error) => error.lineNumber);
}

describe('noSoftBreakInParagraphRule', () => {
  describe('reports a soft break', () => {
    it.each([
      ['a wrapped paragraph', 'alpha\nbravo\n', [1]],
      ['every break of a three-line paragraph', 'alpha\nbravo\ncharlie\n', [1, 2]],
      ['each paragraph of a two-paragraph file', 'alpha\nbravo\ncharlie\n\ndelta\nepsilon\n', [1, 2, 5]],
      ['a wrapped list-item body', '- alpha\n  bravo\n', [1]],
      ['a wrapped nested-list body', '- alpha\n  - bravo\n    charlie\n', [2]],
      ['a wrapped blockquote', '> alpha\n> bravo\n', [1]],
      ['a wrapped footnote body', 'text[^1]\n\n[^1]: alpha\n    bravo\n', [3]],
      ['a break inside emphasis', '*alpha\nbravo*\n', [1]],
      ['a CRLF-wrapped paragraph', 'alpha\r\nbravo\r\n', [1]],
      // CommonMark converts a code span's line endings to spaces, so the wrap encodes nothing there
      // either. A code span is not a literal block, so the literal-block exemption does not reach it.
      ['a wrapped code span', '`alpha\nbravo`\n', [1]],
      ['a wrapped inline math span', '$alpha\nbravo$\n', [1]],
      // The `lineEnding` is the FIRST child of the link's `labelText`, so the rule has no previous sibling
      // to inspect. It is a violation like any other.
      ['a break opening a link label', '[\nalpha](https://example.com)\n', [1]],
      // Inline HTML that is not a line break earns no exemption.
      ['a break after non-break inline HTML', 'alpha<span>\nbravo</span>\n', [1]],
      // The prose between `<summary>` and `</details>` is a real paragraph, not part of the HTML block.
      ['prose inside a `<details>` wrapper', '<details>\n<summary>Sum</summary>\n\nalpha\nbravo\n\n</details>\n', [4]],
      // Line numbers restart at 1 once front matter is stripped, and the offset is added back before the
      // error surfaces.
      ['the real line number after front matter', '---\nalpha: 1\nbravo: 2\n---\n\none\ntwo\n', [6]],
      // Only the callout's MARKER line is exempt. Its body wraps like any other paragraph, so the break at
      // the end of the first body line is a finding while the marker's is not.
      ['a wrapped callout body', '> [!NOTE]\n> alpha\n> bravo\n', [2]],
      // The exemption is anchored to a blockquote marker, so a bracketed word mid-paragraph is not one and
      // must still be reported.
      ['a bracketed marker mid-paragraph', 'see [!important] note\nand more\n', [1]]
    ])('in %s', async (_caseName: string, markdown: string, expectedLineNumbers: number[]) => {
      await expect(getReportedLineNumbers(markdown)).resolves.toEqual(expectedLineNumbers);
    });
  });

  describe('reports nothing', () => {
    it.each([
      ['a one-line paragraph', 'alpha bravo\n'],
      ['blank-line-separated paragraphs', 'alpha\n\nbravo\n'],
      ['a fenced code block', '```js\nconst a = 1;\nconst b = 2;\n```\n'],
      ['an indented code block', '    alpha\n    bravo\n'],
      ['a math block', '$$\nalpha\nbravo\n$$\n'],
      ['a GFM table', '| a | b |\n| - | - |\n| 1 | 2 |\n'],
      ['multi-line YAML front matter', '---\nalpha: 1\nbravo: 2\n---\n\nsolo\n'],
      // An HTML block is re-parsed into a nested `content` / `paragraph` pair, so without the `htmlFlow`
      // skip every newline of these two would be reported — and acting on that rewrites literal HTML.
      ['a multi-line HTML block', '<div>\nalpha\nbravo\n</div>\n'],
      ['a multi-line HTML comment', '<!-- alpha\nbravo -->\n'],
      ['an explicit backslash break', 'alpha\\\nbravo\n'],
      ['an explicit `<br>` break', 'alpha<br>\nbravo\n'],
      ['an explicit `<br/>` break', 'alpha<br/>\nbravo\n'],
      ['an explicit `<br />` break', 'alpha<br />\nbravo\n'],
      ['an explicit `<BR>` break', 'alpha<BR>\nbravo\n'],
      // Two trailing spaces are a break CommonMark accepts; `MD009` already reports them, and one defect
      // deserves one finding.
      ['a two-trailing-spaces break', 'alpha  \nbravo\n'],
      // A link reference definition is not a paragraph, so its layout is left alone for free.
      ['a wrapped link reference definition', '[ref]:\n  https://example.com\n  "Title"\n\n[ref]\n'],
      // `setextHeadingText` is not a paragraph either. A known limitation of the token-type test rather
      // than a decision — recorded so it is not later read as a bug.
      ['a wrapped setext heading', 'alpha\nbravo\n=====\n'],
      // CommonMark knows no callout, so micromark parses a marker and its body as ONE blockquote
      // paragraph — indistinguishable from an ordinary wrapped one. Joining the marker's break destroys
      // the construct in both renderers that matter: GitHub demotes the alert to a literal blockquote,
      // and Obsidian swallows the whole body into the callout's title.
      ['a callout marker line', '> [!NOTE]\n> The body of the callout.\n'],
      ['a titled callout marker line', '> [!info] A title\n> The body.\n'],
      ['a foldable callout marker line', '> [!tip]- Folded\n> The body.\n'],
      ['a nested callout marker line', '> > [!NOTE]\n> > The body.\n'],
      ['an indented callout marker line', '- alpha\n\n  > [!NOTE]\n  > The body.\n']
    ])('for %s', async (_caseName: string, markdown: string) => {
      await expect(getReportedLineNumbers(markdown)).resolves.toEqual([]);
    });
  });

  it('attaches the remedy to every finding', async () => {
    const results = await lint({
      config: {
        default: false,
        [NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME]: true
      },
      customRules: [noSoftBreakInParagraphRule],
      strings: {
        [FILE_NAME]: 'alpha\nbravo\n'
      }
    });

    expect(results[FILE_NAME]).toEqual([
      expect.objectContaining({
        errorDetail: 'Put the whole paragraph on one line, or make the break explicit with a trailing `\\` or `<br>`',
        lineNumber: 1,
        ruleNames: [NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME]
      })
    ]);
  });
});

describe('the shared markdownlint configuration', () => {
  it('registers the rule', () => {
    expect(obsidianDevUtilsConfig.customRules).toContain(noSoftBreakInParagraphRule);
  });

  // Landed OFF on purpose: a repo's first-enable count is not knowable from a wrapped-line heuristic, so
  // each one measures itself with the rule and turns it on in its own `scripts/markdownlint-cli2-config.ts`.
  it('leaves the rule turned off', () => {
    expect(obsidianDevUtilsConfig.config?.[NO_SOFT_BREAK_IN_PARAGRAPH_RULE_NAME]).toBe(false);
  });
});
