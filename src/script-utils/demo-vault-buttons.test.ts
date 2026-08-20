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
  formatFailures,
  listNotesWithButtons
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
      { buttonCount: 1, name: '01 One.md' },
      { buttonCount: 2, name: '02 Two.md' }
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
      { buttonCount: 1, name: '01 Merge/02 Merge folder.md' },
      { buttonCount: 2, name: '03 Split/09 Split by headings.md' }
    ]);
  });

  it('leaves fixture and asset folders alone', () => {
    writeNote('01 One.md', `# One\n\n${button('Alpha')}\n`);
    writeNote('Materials/01 One/Fixture.md', `# Fixture\n\n${button('Bravo')}\n`);
    writeNote('_assets/Snippet.md', `# Snippet\n\n${button('Charlie')}\n`);
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

  it('returns the notes sorted by name', () => {
    writeNote('02 Two.md', button('Bravo'));
    writeNote('01 One.md', button('Alpha'));

    expect(listNotesWithButtons(demoVaultPath, new Set()).map((note) => note.name)).toEqual(['01 One.md', '02 Two.md']);
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
