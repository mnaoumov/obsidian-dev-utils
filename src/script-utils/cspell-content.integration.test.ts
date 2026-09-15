import {
  describe,
  expect,
  it
} from 'vitest';

import { join } from '../path.ts';
import { spellcheckContent } from './linters/cspell-content.ts';

// The real `cspell` runs here rather than a mock of it, because the only thing worth proving is the thing a
// mock replaces: that the content is checked with the configuration `spellcheck` would have used for it.
const CHANGELOG_PATH = join(process.cwd(), 'CHANGELOG.md');

// `spellcheck` reads this file too, so the unknown word cannot be written here as a literal — doing so would
// put the very defect this module exists to catch into the repository, and turn the gate red on the next
// release. Both halves are ordinary English words `cspell` knows; only their concatenation is unknown to it.
const UNKNOWN_WORD = ['lint', 'able'].join('');

describe('spellcheckContent', () => {
  it('should report nothing for content that passes', async () => {
    const findings = await spellcheckContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: add a shiny new feature\n',
      filePath: CHANGELOG_PATH
    });
    expect(findings).toEqual([]);
  });

  it('should report a finding, naming the path the content was checked as', async () => {
    const findings = await spellcheckContent({
      content: `# CHANGELOG\n\n## 1.0.0\n\n- feat: a ${UNKNOWN_WORD} change\n`,
      filePath: CHANGELOG_PATH
    });
    expect(findings).toHaveLength(1);
    // The line number is the written file's own: the section is prepended, so this document is the head of it.
    expect(findings[0]).toContain('CHANGELOG.md:5');
    expect(findings[0]).toContain(UNKNOWN_WORD);
  });

  // The whole point of the `stdin://<path>` form rather than a temp file outside the repository: `xmqj` is in
  // no dictionary anywhere, only in this repository's own `cspell.json`, so accepting it can only mean that
  // configuration was found and applied to a document that exists nowhere on disk.
  it('should apply the repository\'s own word list', async () => {
    const findings = await spellcheckContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: rename the xmqj fixture\n',
      filePath: CHANGELOG_PATH
    });
    expect(findings).toEqual([]);
  });
});
