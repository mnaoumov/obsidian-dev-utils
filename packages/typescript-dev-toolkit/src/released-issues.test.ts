import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  closeReleasedIssues,
  getIssueReferences
} from './released-issues.ts';

const { mockExecFromRoot } = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn<(command: string | string[]) => Promise<string>>()
}));

vi.mock('./root.ts', () => ({
  execFromRoot: mockExecFromRoot
}));

const REPO_URL = 'https://github.com/owner/repo';
const RELEASE_URL = `${REPO_URL}/releases/tag/1.1.0`;
// The GitHub REST API's own snake_case field names.
const PULL_REQUEST_KEY = 'pull_request';
const STATE_REASON_KEY = 'state_reason';

interface IssueFixture {
  readonly comments?: string;
  readonly labels?: string[];
  readonly pullRequest?: object;
  readonly state?: string;
  readonly stateReason?: null | string;
}

interface SetupParams {
  readonly commitMessages: string[];
  readonly issues?: Record<number, Error | IssueFixture>;
  readonly previousTag?: string;
  readonly repoUrl?: string;
}

function getCommands(): string[] {
  return mockExecFromRoot.mock.calls.map(([command]) => Array.isArray(command) ? command.join(' ') : command);
}

function setup(params: SetupParams): void {
  const { commitMessages, issues = {}, previousTag = '1.0.0', repoUrl = REPO_URL } = params;
  mockExecFromRoot.mockImplementation((command) => {
    const commandString = Array.isArray(command) ? command.join(' ') : command;
    if (commandString.startsWith('gh repo view')) {
      return Promise.resolve(repoUrl);
    }
    if (commandString.startsWith('git describe')) {
      return Promise.resolve(previousTag);
    }
    if (commandString.startsWith('git log')) {
      return Promise.resolve(commitMessages.join('\0'));
    }
    const commentsMatch = /^gh api --paginate repos\/owner\/repo\/issues\/(?<number>\d+)\/comments/.exec(commandString);
    if (commentsMatch) {
      const issue = issues[Number(commentsMatch.groups?.['number'])];
      return Promise.resolve(issue instanceof Error ? '' : issue?.comments ?? '');
    }
    const issueMatch = /^gh api repos\/owner\/repo\/issues\/(?<number>\d+)$/.exec(commandString);
    if (issueMatch) {
      const number = Number(issueMatch.groups?.['number']);
      const issue = issues[number];
      if (issue instanceof Error) {
        return Promise.reject(issue);
      }
      return Promise.resolve(JSON.stringify({
        labels: (issue?.labels ?? []).map((name) => ({ name })),
        [PULL_REQUEST_KEY]: issue?.pullRequest,
        state: issue?.state ?? 'open',
        [STATE_REASON_KEY]: issue?.stateReason ?? null,
        title: `Issue ${String(number)}`
      }));
    }
    return Promise.resolve('');
  });
}

describe('getIssueReferences', () => {
  it('should find bare, slug and URL references and mark the closing ones', () => {
    expect(getIssueReferences({
      commitMessages: [
        'fix: thing\n\nre #1',
        'feat: other (#2)',
        'fix: Fixes #3, #4',
        'chore: closes owner/repo#5 and see https://github.com/owner/repo/issues/6',
        'fix: resolved: https://github.com/owner/repo/pull/7'
      ],
      repoSlug: 'owner/repo'
    })).toEqual([
      { isClosing: false, number: 1 },
      { isClosing: false, number: 2 },
      { isClosing: true, number: 3 },
      { isClosing: false, number: 4 },
      { isClosing: true, number: 5 },
      { isClosing: false, number: 6 },
      { isClosing: true, number: 7 }
    ]);
  });

  it('should ignore references into other repositories and glued tokens', () => {
    expect(getIssueReferences({
      commitMessages: ['fix: fixes other/repo#8, fixes repo#9, see https://github.com/other/repo/issues/10 and &#11;'],
      repoSlug: 'owner/repo'
    })).toEqual([]);
  });

  it('should treat a number as closing when any mention of it closes', () => {
    expect(getIssueReferences({
      commitMessages: ['re #12', 'CLOSE #12', 're #12'],
      repoSlug: 'owner/repo'
    })).toEqual([{ isClosing: true, number: 12 }]);
  });

  it('should require the keyword directly before the reference', () => {
    expect(getIssueReferences({
      commitMessages: ['prefix #13', 'fixing #14', 'fix the #15'],
      repoSlug: 'owner/repo'
    })).toEqual([
      { isClosing: false, number: 13 },
      { isClosing: false, number: 14 },
      { isClosing: false, number: 15 }
    ]);
  });
});

describe('closeReleasedIssues', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should close an open issue named with a closing keyword, as Implemented in for a feature', async () => {
    setup({ commitMessages: ['feat: thing\n\ncloses #1'] });
    expect(await closeReleasedIssues({ newVersion: '1.1.0' })).toEqual([]);
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      ['gh', 'issue', 'close', '1', '-R', 'owner/repo', '--reason', 'completed', '--comment', `Implemented in ${RELEASE_URL}`],
      expect.any(Object)
    );
    expect(getCommands()).toContain('git log 1.0.0..1.1.0 --format=%B -z');
  });

  it('should use Fixed in for an issue with a bug label', async () => {
    setup({ commitMessages: ['fix: thing\n\nfixes #2'], issues: { 2: { labels: ['Type: Bug'] } } });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      ['gh', 'issue', 'close', '2', '-R', 'owner/repo', '--reason', 'completed', '--comment', `Fixed in ${RELEASE_URL}`],
      expect.any(Object)
    );
  });

  it('should read the whole history when there is no previous tag', async () => {
    setup({ commitMessages: [], previousTag: '' });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(getCommands()).toContain('git log 1.1.0 --format=%B -z');
  });

  it('should leave an issue named without a closing keyword open, and list it', async () => {
    setup({ commitMessages: ['fix: thing\n\nre #3', 'fix: more re #4'], issues: { 4: { state: 'closed' } } });
    const warnSpy = vi.spyOn(console, 'warn');
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(getCommands().some((command) => command.startsWith('gh issue'))).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('#3 Issue 3'));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('#4 Issue 4'));
  });

  it('should skip a pull request', async () => {
    setup({ commitMessages: ['fixes #5'], issues: { 5: { pullRequest: {} } } });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(getCommands().some((command) => command.startsWith('gh issue'))).toBe(false);
  });

  it('should comment on an issue GitHub already closed as completed', async () => {
    setup({ commitMessages: ['fixes #6'], issues: { 6: { comments: 'Thanks!', state: 'closed', stateReason: 'completed' } } });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(mockExecFromRoot).toHaveBeenCalledWith(
      ['gh', 'issue', 'comment', '6', '-R', 'owner/repo', '--body', `Implemented in ${RELEASE_URL}`],
      expect.any(Object)
    );
  });

  it('should not comment twice on a closed issue that already links this release', async () => {
    setup({
      commitMessages: ['fixes #7'],
      issues: { 7: { comments: `Implemented in ${RELEASE_URL}`, state: 'closed', stateReason: 'completed' } }
    });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(getCommands().some((command) => command.startsWith('gh issue'))).toBe(false);
  });

  it('should not comment on an issue closed as not planned', async () => {
    setup({ commitMessages: ['fixes #8'], issues: { 8: { state: 'closed', stateReason: 'not_planned' } } });
    await closeReleasedIssues({ newVersion: '1.1.0' });
    expect(getCommands().some((command) => command.includes('comments') || command.startsWith('gh issue'))).toBe(false);
  });

  it('should report an issue it could not read and carry on with the rest', async () => {
    setup({ commitMessages: ['fixes #9', 'fixes #10'], issues: { 9: new Error('Not Found') } });
    const warnSpy = vi.spyOn(console, 'warn');
    expect(await closeReleasedIssues({ newVersion: '1.1.0' })).toEqual([9]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not process issue #9 of owner/repo'));
    expect(mockExecFromRoot).toHaveBeenCalledWith(expect.arrayContaining(['gh', 'issue', 'close', '10']), expect.any(Object));
  });

  it('should do nothing outside a GitHub repository', async () => {
    setup({ commitMessages: ['fixes #11'], repoUrl: 'https://gitlab.com/owner/repo' });
    const warnSpy = vi.spyOn(console, 'warn');
    expect(await closeReleasedIssues({ newVersion: '1.1.0' })).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('is not a GitHub repository URL'));
    expect(getCommands().some((command) => command.startsWith('git log'))).toBe(false);
  });
});
