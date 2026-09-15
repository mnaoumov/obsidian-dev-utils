import {
  describe,
  expect,
  it
} from 'vitest';

import { join } from '../path.ts';
import { lintMarkdownContent } from './linters/markdownlint-content.ts';

// The real `markdownlint-cli2` runs here rather than a mock of it, because the only thing worth proving is the
// thing a mock replaces: that the content is linted with the configuration `lint:md` would have used for it.
// That is why these cases are integration tests and their unit siblings are not — the run loads this
// repository's own TypeScript configuration through `jiti`, whose copy of the custom rule module then collides
// with the vite-loaded one in the v8 coverage report, and the coverage run does not include this project.
const CHANGELOG_PATH = join(process.cwd(), 'CHANGELOG.md');

describe('lintMarkdownContent', () => {
  it('should report nothing for content that passes', async () => {
    const findings = await lintMarkdownContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: add a shiny new feature\n',
      filePath: CHANGELOG_PATH
    });
    expect(findings).toEqual([]);
  });

  it('should report a finding, naming the path the content was linted as', async () => {
    const findings = await lintMarkdownContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: add a shiny new feature   \n',
      filePath: CHANGELOG_PATH
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('CHANGELOG.md:5');
    expect(findings[0]).toContain('MD009/no-trailing-spaces');
  });

  // The whole point of going through `markdownlint-cli2` rather than `markdownlint`'s string API: this rule is
  // OFF in the shared configuration and ON in this repository's own, so a finding here can only have come from
  // the repository's `.markdownlint-cli2.mjs` having been found, loaded and merged.
  it('should apply the repository\'s own configuration rather than the shared default', async () => {
    const findings = await lintMarkdownContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: a note that is hard-wrapped\n  onto a second line\n',
      filePath: CHANGELOG_PATH
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('no-soft-break-in-paragraph');
  });

  // The release lints a section that is about to become the head of `CHANGELOG.md`, and reports the line
  // numbers it will have there. Nothing else in the repository may be read while it does so.
  it('should lint the content alone, never the repository\'s own markdown', async () => {
    const findings = await lintMarkdownContent({
      content: '# CHANGELOG\n\n## 1.0.0\n\n- feat: add a shiny new feature\n',
      filePath: join(process.cwd(), 'no-such-file.md')
    });
    expect(findings).toEqual([]);
  });
});
