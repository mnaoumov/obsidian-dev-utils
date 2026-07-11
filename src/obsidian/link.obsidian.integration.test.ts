/**
 * @file
 *
 * Integration tests for `file://` link normalization against a real Obsidian instance.
 * Confirms the end-to-end round-trip (real metadata parse -> link selection -> converter ->
 * frontmatter/body write-back) normalizes `file://` links in BOTH the note body and frontmatter values.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

/**
 * Result of the `file://` normalization test.
 */
interface NormalizeResult {
  readonly result: string;
}

describe('file:// link normalization', () => {
  it('should normalize file:// links in both frontmatter and body', async () => {
    const { result } = await evalInObsidian<Record<string, never>, NormalizeResult>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const content = '---\nurl: file:///F:%5Cover%5Care.txt\n---\n\n[body](file:///F:%5Cover%5Cage.txt)\n';
        const normalized = await lib.obsidian.link.updateFileUrlLinksInContent({ app, content });
        return { result: normalized };
      }
    });

    expect(result).toContain('file:///F:/over/are.txt');
    expect(result).toContain('[body](file:///F:/over/age.txt)');
    expect(result).not.toContain('%5C');
  });
});
