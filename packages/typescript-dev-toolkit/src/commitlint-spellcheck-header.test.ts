import type { PackageJson } from 'type-fest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { SpellcheckContentParams } from './linters/cspell-content.ts';
import type { ResolvePathFromRootSafeParams } from './root.ts';

import {
  SPELLCHECK_HEADER_RULE_NAME,
  spellcheckHeaderPlugin,
  spellcheckHeaderRule
} from './commitlint-spellcheck-header.ts';

const {
  mockReadPackageJson,
  mockResolvePathFromRootSafe,
  mockSpellcheckContent
} = vi.hoisted(() => ({
  mockReadPackageJson: vi.fn<() => Promise<PackageJson>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockSpellcheckContent: vi.fn<(params: SpellcheckContentParams) => Promise<string[]>>()
}));

vi.mock('./linters/cspell-content.ts', () => ({
  spellcheckContent: mockSpellcheckContent
}));

vi.mock('./npm.ts', () => ({
  readPackageJson: mockReadPackageJson
}));

vi.mock('./root.ts', () => ({
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

type Commit = Parameters<typeof spellcheckHeaderRule>[0];

function makeCommit(header: null | string): Commit {
  return {
    body: null,
    footer: null,
    header
  } as Commit;
}

describe('spellcheckHeaderRule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockResolvePathFromRootSafe.mockImplementation(({ path }) => `/repo/${path}`);
    mockReadPackageJson.mockResolvedValue({ scripts: { spellcheck: 'cspell .' } });
  });

  it('should pass a commit with no header without spellchecking', async () => {
    await expect(spellcheckHeaderRule(makeCommit(null))).resolves.toEqual([true]);
    expect(mockSpellcheckContent).not.toHaveBeenCalled();
  });

  it.each(
    [
      ['no scripts at all', {}],
      ['no spellcheck script', { scripts: { build: 'tsc' } }]
    ] as const
  )('should pass without spellchecking in a project with %s', async (_label, packageJson) => {
    mockReadPackageJson.mockResolvedValue(packageJson);
    await expect(spellcheckHeaderRule(makeCommit('fix: thing'))).resolves.toEqual([true]);
    expect(mockSpellcheckContent).not.toHaveBeenCalled();
  });

  it('should spellcheck the header as the changelog bullet it becomes', async () => {
    mockSpellcheckContent.mockResolvedValue([]);
    await expect(spellcheckHeaderRule(makeCommit('docs: fix two tags'))).resolves.toEqual([true]);
    expect(mockSpellcheckContent).toHaveBeenCalledWith({
      content: '- docs: fix two tags\n',
      filePath: '/repo/CHANGELOG.md'
    });
  });

  it('should refuse a header with an unknown word, naming the finding', async () => {
    // Assembled, because `spellcheck` reads this file too and the literal would fail it.
    const unknownWord = ['re', 'point'].join('');
    const finding = `/repo/CHANGELOG.md:1:9 - Unknown word (${unknownWord})`;
    mockSpellcheckContent.mockResolvedValue([finding]);
    const [isValid, message] = await spellcheckHeaderRule(makeCommit(`docs: ${unknownWord} two tags`));
    expect(isValid).toBe(false);
    expect(message).toContain('`spellcheck`');
    expect(message).toContain(finding);
  });

  it('should propagate a failing cspell', async () => {
    mockSpellcheckContent.mockRejectedValue(new Error('cspell exited with 2'));
    await expect(spellcheckHeaderRule(makeCommit('fix: thing'))).rejects.toThrow('cspell exited with 2');
  });
});

describe('spellcheckHeaderPlugin', () => {
  it('should register the rule under its name', () => {
    expect(spellcheckHeaderPlugin.rules[SPELLCHECK_HEADER_RULE_NAME]).toBe(spellcheckHeaderRule);
  });
});
