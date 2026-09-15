import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ExecResult } from './exec.ts';
import type { ResolveToolCommandParams } from './package-manager.ts';

import { spellcheckContent } from './linters/cspell-content.ts';

const { mockExecFromRoot, mockResolveToolCommand } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn<() => Promise<ExecResult>>(),
  mockResolveToolCommand: vi.fn<(params: ResolveToolCommandParams) => string[]>()
}));

vi.mock('../script-utils/root.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./root.ts')>();
  return {
    ...$module,
    execFromRoot: mockExecFromRoot
  };
});

vi.mock('../script-utils/package-manager.ts', () => ({
  resolveToolCommand: mockResolveToolCommand
}));

// `spellcheck` reads this file too, so the unknown word cannot be written here as a literal — doing so would
// put the very defect this module exists to catch into the repository, and turn the gate red on the next
// release. Both halves are ordinary English words `cspell` knows; only their concatenation is unknown to it.
const UNKNOWN_WORD = ['lint', 'able'].join('');
const UNKNOWN_WORD_FINDING = `CHANGELOG.md:5:11 - Unknown word (${UNKNOWN_WORD})`;
const SECOND_FINDING = 'CHANGELOG.md:6:3 - Unknown word (foobaz)';

function stubExecResult(result: Partial<ExecResult>): void {
  mockExecFromRoot.mockResolvedValue({
    exitCode: 0,
    exitSignal: null,
    stderr: '',
    stdout: '',
    ...result
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  stubExecResult({});
  mockResolveToolCommand.mockImplementation((params: ResolveToolCommandParams) => [params.tool]);
});

describe('spellcheckContent', () => {
  it('should check the content as the given path, on the child\'s stdin', async () => {
    // A system path, to pin the POSIX normalization: `stdin://` is parsed as a URL, and a Windows path's
    // backslashes do not survive that.
    await spellcheckContent({
      content: '# CHANGELOG\n',
      filePath: String.raw`F:\root\CHANGELOG.md`
    });

    expect(mockExecFromRoot).toHaveBeenCalledWith([
      'cspell',
      'lint',
      '--no-progress',
      '--no-must-find-files',
      '--no-summary',
      '--no-color',
      'stdin://F:/root/CHANGELOG.md'
    ], {
      isQuiet: true,
      shouldIgnoreExitCode: true,
      shouldIncludeDetails: true,
      stdin: '# CHANGELOG\n'
    });
  });

  it('should report nothing when nothing is reported', async () => {
    const findings = await spellcheckContent({
      content: '# CHANGELOG\n',
      filePath: '/root/CHANGELOG.md'
    });
    expect(findings).toEqual([]);
  });

  // A `severity: warning` word is printed and still exits `0`, so the lines alone would fail a release on
  // something `spellcheck` itself passes.
  it('should report nothing for lines printed on a successful exit', async () => {
    stubExecResult({ stdout: `${UNKNOWN_WORD_FINDING}\n` });
    const findings = await spellcheckContent({
      content: '# CHANGELOG\n',
      filePath: '/root/CHANGELOG.md'
    });
    expect(findings).toEqual([]);
  });

  it('should report one finding per reported line', async () => {
    stubExecResult({
      exitCode: 1,
      stdout: `${UNKNOWN_WORD_FINDING}\n${SECOND_FINDING}\n`
    });

    const findings = await spellcheckContent({
      content: '# CHANGELOG\n',
      filePath: '/root/CHANGELOG.md'
    });

    expect(findings).toEqual([UNKNOWN_WORD_FINDING, SECOND_FINDING]);
  });

  // The tool failing to run at all exits non-zero with an empty stdout. Reading that as a clean document would
  // let through exactly what this module exists to catch, so it has to be louder than a `[]`.
  it('should throw when the tool fails without reporting anything', async () => {
    stubExecResult({
      exitCode: 2,
      stderr: 'Failed to read config file'
    });

    await expect(spellcheckContent({
      content: '# CHANGELOG\n',
      filePath: '/root/CHANGELOG.md'
    })).rejects.toThrow('`cspell` exited with 2 without reporting anything:\nFailed to read config file');
  });
});
