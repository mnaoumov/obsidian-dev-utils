/**
 * @file
 *
 * Closes the GitHub issues a release carries, with a comment linking the release.
 *
 * An issue that a commit in the release names with a closing keyword (`fixes #12`, `closes #12`, `resolves #12`,
 * and their other tenses) is closed as completed, with `Fixed in <release URL>` when it carries a `bug` label and
 * `Implemented in <release URL>` otherwise. The URL is the `releases/tag/<version>` page, which exists by the time
 * this runs.
 *
 * Only a closing keyword closes anything. A bare mention (`re #12`, `(#12)`, the issue URL) is often one step of
 * unfinished work, and this module cannot know whether the rest has landed, so such an issue is listed as left open
 * and nothing is posted to it.
 *
 * GitHub itself closes an issue named with a closing keyword as soon as the commit reaches the default branch —
 * before the release, and without saying which release carries the change. So an issue that is already closed as
 * completed still gets the release link, unless one of its comments already carries this release's URL, which also
 * makes a second run post nothing.
 */

import { errorToString } from '../error.ts';
import {
  escapeRegExp,
  getOptionalNamedGroup
} from '../reg-exp.ts';
import { execFromRoot } from './root.ts';

/**
 * Params for {@link closeReleasedIssues}.
 */
export interface CloseReleasedIssuesParams {
  /**
   * The version just released. Its tag must exist locally and its GitHub release must be published.
   */
  readonly newVersion: string;
}

/**
 * Params for {@link getIssueReferences}.
 */
export interface GetIssueReferencesParams {
  /**
   * The commit messages to read.
   */
  readonly commitMessages: readonly string[];

  /**
   * The `<owner>/<name>` of the repository whose issues count. A reference into any other repository is ignored.
   */
  readonly repoSlug: string;
}

/**
 * An issue number named by the commit messages of a release.
 */
export interface IssueReference {
  /**
   * Whether at least one mention used a closing keyword.
   */
  readonly isClosing: boolean;

  /**
   * The issue or pull request number.
   */
  readonly number: number;
}

interface GitHubIssue {
  readonly labels: readonly GitHubLabel[];
  readonly pull_request?: unknown;
  readonly state: string;
  readonly state_reason?: null | string;
  readonly title: string;
}

interface GitHubLabel {
  readonly name: string;
}

/**
 * Closes the issues the release of {@link CloseReleasedIssuesParams.newVersion} carries, as described in the file
 * overview.
 *
 * A failure to read or update one issue is reported and the rest are still processed, because the release is
 * already published by the time this runs and nothing about it can be undone.
 *
 * @param params - The {@link CloseReleasedIssuesParams}.
 * @returns A {@link Promise} that resolves to the numbers of the issues that could not be processed.
 */
export async function closeReleasedIssues(params: CloseReleasedIssuesParams): Promise<number[]> {
  const { newVersion } = params;
  const repoUrl = await execFromRoot('gh repo view --json url -q .url', { isQuiet: true });
  const repoSlug = toRepoSlug(repoUrl);
  if (!repoSlug) {
    console.warn(`Not closing the released issues: '${repoUrl}' is not a GitHub repository URL.`);
    return [];
  }

  const previousTag = await execFromRoot(['git', 'describe', '--tags', '--abbrev=0', `${newVersion}^`], {
    isQuiet: true,
    shouldIgnoreExitCode: true
  });
  const commitRange = previousTag ? `${previousTag}..${newVersion}` : newVersion;
  const commitMessagesString = await execFromRoot(['git', 'log', commitRange, '--format=%B', '-z'], { isQuiet: true });
  const references = getIssueReferences({ commitMessages: commitMessagesString.split('\0'), repoSlug });
  const releaseUrl = `${repoUrl}/releases/tag/${newVersion}`;
  const failedNumbers: number[] = [];
  const leftOpenLines: string[] = [];

  for (const reference of references) {
    try {
      const issue = JSON.parse(await execFromRoot(['gh', 'api', `repos/${repoSlug}/issues/${String(reference.number)}`], { isQuiet: true })) as GitHubIssue;
      if (issue.pull_request !== undefined) {
        continue;
      }

      const comment = `${issue.labels.some((label) => /bug/i.test(label.name)) ? 'Fixed in' : 'Implemented in'} ${releaseUrl}`;
      const isOpen = issue.state === 'open';

      if (!reference.isClosing) {
        if (isOpen) {
          leftOpenLines.push(`  #${String(reference.number)} ${issue.title}`);
        }
        continue;
      }

      if (isOpen) {
        await execFromRoot(['gh', 'issue', 'close', String(reference.number), '-R', repoSlug, '--reason', 'completed', '--comment', comment], {
          isQuiet: true
        });
        console.warn(`Closed #${String(reference.number)} ${issue.title}: ${comment}`);
        continue;
      }

      if (issue.state_reason !== 'completed' || await hasCommentContaining(repoSlug, reference.number, releaseUrl)) {
        continue;
      }

      await execFromRoot(['gh', 'issue', 'comment', String(reference.number), '-R', repoSlug, '--body', comment], { isQuiet: true });
      console.warn(`Commented on the already closed #${String(reference.number)} ${issue.title}: ${comment}`);
    } catch (error) {
      failedNumbers.push(reference.number);
      console.warn(`Could not process issue #${String(reference.number)} of ${repoSlug}: ${errorToString(error)}`);
    }
  }

  if (leftOpenLines.length > 0) {
    console.warn(
      `Left open: the release names these issues without a closing keyword, so whether they are finished is not known here:\n${leftOpenLines.join('\n')}`
    );
  }

  return failedNumbers;
}

/**
 * Collects the issue numbers of one repository that a set of commit messages names, and whether each was named with
 * a closing keyword.
 *
 * Three forms count: a bare `#12`, `<owner>/<name>#12`, and the repository's `issues/12` or `pull/12` URL. A bare
 * `#12` glued to a preceding token (`other#12`, `other/repo#12`, `&#12`) does not. A mention is closing when
 * GitHub's own closing keyword precedes it directly: `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`,
 * `resolve`, `resolves` or `resolved`, in any case, optionally followed by a colon.
 *
 * @param params - The {@link GetIssueReferencesParams}.
 * @returns The references, sorted by number, one per number.
 */
export function getIssueReferences(params: GetIssueReferencesParams): IssueReference[] {
  const { commitMessages, repoSlug } = params;
  const escapedSlug = escapeRegExp(repoSlug);
  const regExp = new RegExp(
    String.raw`(?<keyword>\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+)?(?:https?://github\.com/${escapedSlug}/(?:issues|pull)/(?<urlNumber>\d+)|(?<![\w.-])${escapedSlug}#(?<slugNumber>\d+)\b|(?<![\w/&#.-])#(?<bareNumber>\d{1,6})\b)`,
    'gi'
  );
  const closingFlagByNumber = new Map<number, boolean>();

  for (const commitMessage of commitMessages) {
    for (const match of commitMessage.matchAll(regExp)) {
      const number = Number(
        getOptionalNamedGroup(match, 'urlNumber') ?? getOptionalNamedGroup(match, 'slugNumber') ?? getOptionalNamedGroup(match, 'bareNumber')
      );
      closingFlagByNumber.set(number, (closingFlagByNumber.get(number) ?? false) || getOptionalNamedGroup(match, 'keyword') !== null);
    }
  }

  return [...closingFlagByNumber]
    .sort(([number1], [number2]) => number1 - number2)
    .map(([number, isClosing]) => ({ isClosing, number }));
}

async function hasCommentContaining(repoSlug: string, issueNumber: number, text: string): Promise<boolean> {
  const bodies = await execFromRoot(['gh', 'api', '--paginate', `repos/${repoSlug}/issues/${String(issueNumber)}/comments`, '--jq', '.[].body'], {
    isQuiet: true
  });
  return bodies.includes(text);
}

function toRepoSlug(repoUrl: string): null | string {
  const match = /^https:\/\/github\.com\/(?<slug>[^/]+\/[^/]+?)\/?$/.exec(repoUrl);
  return match?.groups?.['slug'] ?? null;
}
