import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join
} from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { DemoVaultButtonResult } from './demo-vault-buttons.ts';

import {
  assertClickBudgetsFitTransportCap,
  countRenderedButtons,
  findDuplicateCaptions,
  formatFailures,
  listNotesWithButtons,
  listRenderedButtonCaptions,
  selectUnexpectedFailures
} from './demo-vault-buttons.ts';

let demoVaultPath: string;

function button(caption: string): string {
  return ['```code-button', '---', `caption: ${caption}`, '---', 'noop();', '```'].join('\n');
}

function writeNote(name: string, content: string): void {
  mkdirSync(dirname(join(demoVaultPath, name)), { recursive: true });
  writeFileSync(join(demoVaultPath, name), content, 'utf-8');
}

describe('listNotesWithButtons', () => {
  beforeEach(() => {
    demoVaultPath = mkdtempSync(join(tmpdir(), 'demo-vault-buttons-'));
  });

  afterEach(() => {
    rmSync(demoVaultPath, { force: true, recursive: true });
  });

  it('counts the code-button fences in each note', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('02 Two.md', `# Two\n\n${button('Bravo')}\n\n${button('Charlie')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set())).toEqual([
      { buttonCount: 1, captions: ['Alpha'], name: '01 One.md' },
      { buttonCount: 2, captions: ['Bravo', 'Charlie'], name: '02 Two.md' }
    ]);
  });

  it('omits notes that declare no button', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('02 Prose only.md', '# Prose only\n\nNothing to click here.\n');

    expect(listNotesWithButtons(demoVaultPath, new Set()).map((note) => note.name)).toEqual(['01 One.md']);
  });

  it('counts an indented fence, which a nested list item produces', () => {
    writeNote('01 One.md', `# One\n\n1. Step\n\n   ${button('Alpha').replaceAll('\n', '\n   ')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set())[0]?.buttonCount).toBe(1);
  });

  it('skips the excluded notes', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('README.md', `# Readme\n\n${button('Bravo')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set(['README.md'])).map((note) => note.name)).toEqual(['01 One.md']);
  });

  it('walks group folders, because a grouped vault keeps no walkthrough at its root', () => {
    writeNote('01 Merge/02 Merge folder.md', `# Merge folder\n\n${button('Alpha')}\n`);
    writeNote('03 Split/09 Split by headings.md', `# Split\n\n${button('Bravo')}\n\n${button('Charlie')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set())).toEqual([
      { buttonCount: 1, captions: ['Alpha'], name: '01 Merge/02 Merge folder.md' },
      { buttonCount: 2, captions: ['Bravo', 'Charlie'], name: '03 Split/09 Split by headings.md' }
    ]);
  });

  it('leaves fixture and asset folders alone', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('Materials/01 One/Fixture.md', `# Fixture\n\n${button('Bravo')}\n`);
    writeNote('_assets/Snippet.md', `# Snippet\n\n${button('Charlie')}\n`);
    // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Testing that a note under the default config folder is skipped.
    writeNote('.obsidian/Notes.md', `# Config\n\n${button('Delta')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set()).map((note) => note.name)).toEqual(['01 One.md']);
  });

  it('excludes a grouped note by its file name or by its path', () => {
    writeNote('01 Merge/README.md', `# Readme\n\n${button('Alpha')}\n`);
    writeNote('01 Merge/02 Merge folder.md', `# Merge folder\n\n${button('Bravo')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set(['README.md'])).map((note) => note.name)).toEqual(['01 Merge/02 Merge folder.md']);
    expect(listNotesWithButtons(demoVaultPath, new Set(['01 Merge/02 Merge folder.md'])).map((note) => note.name)).toEqual(['01 Merge/README.md']);
  });

  it('ignores non-markdown files and sub-folders', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('notes.txt', button('Bravo'));
    mkdirSync(join(demoVaultPath, 'Materials'));
    writeFileSync(join(demoVaultPath, 'Materials', 'Fixture.md'), button('Charlie'), 'utf-8');

    expect(listNotesWithButtons(demoVaultPath, new Set()).map((note) => note.name)).toEqual(['01 One.md']);
  });

  it('skips an excluded folder by its name or by its path', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('08 Other plugins/01 Dataview.md', `# Dataview\n\n${button('Bravo')}\n`);
    writeNote('09 Group/Nested/01 Deep.md', `# Deep\n\n${button('Charlie')}\n`);
    writeNote('09 Group/02 Shallow.md', `# Shallow\n\n${button('Delta')}\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set(), new Set(['08 Other plugins', '09 Group/Nested'])).map((note) => note.name))
      .toEqual(['01 One.md', '09 Group/02 Shallow.md']);
  });

  it('does not count a code-button sample nested in a longer fence', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n\n\`\`\`\`markdown\n${button('Sample')}\n\`\`\`\`\n`);

    expect(listNotesWithButtons(demoVaultPath, new Set())).toEqual([{ buttonCount: 1, captions: ['Alpha'], name: '01 One.md' }]);
  });

  it('returns the notes sorted by name', () => {
    writeNote('02 Two.md', button('Bravo'));
    writeNote('01 One.md', button('Alpha'));

    expect(listNotesWithButtons(demoVaultPath, new Set()).map((note) => note.name)).toEqual(['01 One.md', '02 Two.md']);
  });
});

describe('assertClickBudgetsFitTransportCap', () => {
  it('accepts the defaults, which sum to 22 000 ms', () => {
    expect(() => {
      assertClickBudgetsFitTransportCap({
        buttonResultTimeoutInMilliseconds: 10_000,
        settleTimeoutInMilliseconds: 12_000
      });
    }).not.toThrow();
  });

  // One millisecond under the cap is the last pair a transport call can still honour.
  it('accepts a pair one millisecond under the cap', () => {
    expect(() => {
      assertClickBudgetsFitTransportCap({
        buttonResultTimeoutInMilliseconds: 10_000,
        settleTimeoutInMilliseconds: 19_999
      });
    }).not.toThrow();
  });

  // The lint rule reports AT the cap as well as over it; the runtime bound draws the line in the same place.
  it('refuses a pair exactly at the cap', () => {
    expect(() => {
      assertClickBudgetsFitTransportCap({
        buttonResultTimeoutInMilliseconds: 10_000,
        settleTimeoutInMilliseconds: 20_000
      });
    }).toThrow('30000 ms script timeout');
  });

  it('names both budgets and their sum, which the script timeout it replaces names neither of', () => {
    let message = '';
    try {
      assertClickBudgetsFitTransportCap({
        buttonResultTimeoutInMilliseconds: 15_000,
        settleTimeoutInMilliseconds: 20_000
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('settleTimeoutInMilliseconds (20000 ms)');
    expect(message).toContain('buttonResultTimeoutInMilliseconds (15000 ms)');
    expect(message).toContain('sum of 35000 ms');
  });
});

describe('formatFailures', () => {
  it('is empty when nothing failed', () => {
    expect(formatFailures('01 One.md', [])).toBe('');
  });

  it('names the note, each caption, its status and its output', () => {
    const failures: DemoVaultButtonResult[] = [
      { caption: 'Alpha', output: 'Error: boom\n  at somewhere', status: 'error' },
      { caption: 'Bravo', output: '', status: 'timeout' }
    ];

    const message = formatFailures('01 One.md', failures);

    expect(message).toContain('2 button(s) in 01 One.md did not run cleanly');
    // The output is collapsed onto one line so a multi-line stack stays readable in the reporter.
    expect(message).toContain('- "Alpha" [error]: Error: boom at somewhere');
    expect(message).toContain('- "Bravo" [timeout]:');
  });
});

describe('countRenderedButtons', () => {
  it('counts every top-level code-button fence', () => {
    expect(countRenderedButtons([button('Alpha'), 'Prose.', button('Bravo')].join('\n\n'))).toBe(2);
  });

  it('counts nothing in a note without fences', () => {
    expect(countRenderedButtons('# Title\n\nJust prose.\n')).toBe(0);
  });

  it('ignores a code-button fence nested in a longer backtick fence, which is a sample shown to the reader', () => {
    const source = ['````markdown', button('Sample'), '````', '', button('Real')].join('\n');

    expect(countRenderedButtons(source)).toBe(1);
  });

  it('ignores a code-button fence nested in a tilde fence, whatever its length', () => {
    const source = ['~~~markdown', button('Sample'), '~~~', '', button('Real')].join('\n');

    expect(countRenderedButtons(source)).toBe(1);
  });

  it('does not close a backtick fence on a tilde run, or a long fence on a shorter one', () => {
    const source = ['````markdown', '~~~', '```', button('Sample'), '````', button('Real')].join('\n');

    expect(countRenderedButtons(source)).toBe(1);
  });

  it('does not close a fence on a marker line carrying an info string', () => {
    const source = ['```code-button', '```js', 'noop();', '```'].join('\n');

    expect(countRenderedButtons(source)).toBe(1);
  });

  it('ignores a fence of another language', () => {
    expect(countRenderedButtons(['```js', 'noop();', '```', button('Real')].join('\n'))).toBe(1);
  });

  it('ignores a code-button fence carrying legacy arguments, which renders an error banner and no button', () => {
    expect(countRenderedButtons(['```code-button "Run" raw', 'noop();', '```'].join('\n'))).toBe(0);
  });

  it('ignores an isRaw fence, which renders no button element', () => {
    const raw = ['```code-button', '---', 'isRaw: true', '---', 'noop();', '```'].join('\n');

    expect(countRenderedButtons([raw, button('Real')].join('\n\n'))).toBe(1);
  });

  it('counts a fence whose isRaw is false', () => {
    expect(countRenderedButtons(['```code-button', '---', 'isRaw: false', '---', 'noop();', '```'].join('\n'))).toBe(1);
  });

  it('reads isRaw from the config block only, not from the code demonstrating it', () => {
    const source = ['```code-button', '---', 'caption: Demo', '---', 'isRaw: true', '```'].join('\n');

    expect(countRenderedButtons(source)).toBe(1);
  });

  it('counts a fence whose body opens with no config block, or an unterminated one', () => {
    expect(countRenderedButtons(['```code-button', 'isRaw: true', '```'].join('\n'))).toBe(1);
    expect(countRenderedButtons(['```code-button', '---', 'isRaw: true', '```'].join('\n'))).toBe(1);
  });

  it('counts a fence left open at the end of the note, which CommonMark runs to the end and still renders', () => {
    expect(countRenderedButtons(['```code-button', 'noop();'].join('\n'))).toBe(1);
  });

  it('reads CRLF line endings', () => {
    expect(countRenderedButtons(button('Alpha').replaceAll('\n', '\r\n'))).toBe(1);
  });
});

describe('selectUnexpectedFailures', () => {
  const results: DemoVaultButtonResult[] = [
    { caption: 'Works', output: '', status: 'ok' },
    { caption: 'Run on error only', output: '', status: 'error' },
    { caption: 'shouldShowSystemMessages=false', output: '', status: 'timeout' },
    { caption: 'Broken', output: '', status: 'unknown' }
  ];

  it('returns every non-ok result when nothing is expected', () => {
    expect(selectUnexpectedFailures('01 One.md', results, []).map((result) => result.caption))
      .toEqual(['Run on error only', 'shouldShowSystemMessages=false', 'Broken']);
  });

  it('drops a result matching an expected note, caption substring and status', () => {
    expect(
      selectUnexpectedFailures('01 One.md', results, [
        { captionIncludes: 'on error only', note: '01 One.md', status: 'error' },
        { captionIncludes: 'shouldShowSystemMessages', note: '01 One.md', status: 'timeout' }
      ]).map((result) => result.caption)
    ).toEqual(['Broken']);
  });

  it('keeps a result whose status differs from the expected one', () => {
    expect(
      selectUnexpectedFailures('01 One.md', results, [{ captionIncludes: 'on error only', note: '01 One.md', status: 'timeout' }])
        .map((result) => result.caption)
    ).toContain('Run on error only');
  });

  it('keeps a result expected in another note', () => {
    expect(
      selectUnexpectedFailures('01 One.md', results, [{ captionIncludes: 'on error only', note: '02 Two.md', status: 'error' }])
        .map((result) => result.caption)
    ).toContain('Run on error only');
  });
});

describe('listRenderedButtonCaptions', () => {
  function fence(...configLines: string[]): string {
    return ['```code-button', '---', ...configLines, '---', 'noop();', '```'].join('\n');
  }

  it('lists the captions of the rendered buttons in source order, skipping the fences that render none', () => {
    const raw = fence('caption: Raw', 'isRaw: true');
    const sample = ['````markdown', button('Sample'), '````'].join('\n');

    expect(listRenderedButtonCaptions([button('Alpha'), raw, sample, button('Bravo')].join('\n\n'))).toEqual(['Alpha', 'Bravo']);
  });

  it('gives a fence naming no caption CodeScript Toolkit\'s default, which is what its button shows', () => {
    expect(listRenderedButtonCaptions(fence('isRaw: false'))).toEqual(['(no caption)']);
    expect(listRenderedButtonCaptions(['```code-button', 'noop();', '```'].join('\n'))).toEqual(['(no caption)']);
  });

  it('reads the caption from the config block only, not from the code demonstrating it', () => {
    const source = ['```code-button', '---', 'isRaw: false', '---', 'caption: In the code', '```'].join('\n');

    expect(listRenderedButtonCaptions(source)).toEqual(['(no caption)']);
  });

  it('unquotes a single-quoted or double-quoted caption', () => {
    expect(listRenderedButtonCaptions(fence('caption: \'It\'\'s here: now\''))).toEqual(['It\'s here: now']);
    expect(listRenderedButtonCaptions(fence(String.raw`caption: "Say \"hi\""`))).toEqual(['Say "hi"']);
  });

  it('keeps a double-quoted caption it cannot parse as written between its quotes', () => {
    expect(listRenderedButtonCaptions(fence(String.raw`caption: "C:\query"`))).toEqual([String.raw`C:\query`]);
  });

  it('reads the config of a fence indented under a list item, whose content CommonMark strips of that indentation', () => {
    function indent(text: string): string {
      return `   ${text.replaceAll('\n', '\n   ')}`;
    }
    const source = ['1. Step', '', indent(button('Alpha')), '', indent(fence('caption: Raw', 'isRaw: true'))].join('\n');

    expect(listRenderedButtonCaptions(source)).toEqual(['Alpha']);
  });

  it('drops a trailing comment from a plain caption and trims it', () => {
    expect(listRenderedButtonCaptions(fence('caption:   Where would a pasted image go now?   # asked twice'))).toEqual([
      'Where would a pasted image go now?'
    ]);
  });
});

describe('findDuplicateCaptions', () => {
  it('is empty when every caption is distinct', () => {
    expect(findDuplicateCaptions(['Alpha', 'Bravo'])).toEqual([]);
  });

  it('names each repeated caption once, in order of its first repeat', () => {
    expect(findDuplicateCaptions(['Alpha', 'Bravo', 'Bravo', 'Alpha', 'Bravo', 'Charlie'])).toEqual(['Bravo', 'Alpha']);
  });
});
