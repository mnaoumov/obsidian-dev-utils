/**
 * @file
 *
 * Integration tests for the code block processor utilities.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import dedent from 'dedent';
import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

interface ReadNoteContent {
  content: string;
}
type ReadNoteContentArgs = GenericObject<ReadNoteContent>;

describe('markdown-code-block-processor', () => {
  it('should read note content with code block from vault', async () => {
    const content = `${dedent`
        # Test Note

        \`\`\`js
        console.log("hello");
        \`\`\`
      `}\n`;
    const result = await evalInObsidian<ReadNoteContentArgs, string>({
      args: { content },
      async fn({ app, content: noteContent }) {
        const file = await app.vault.create('code-block-test.md', noteContent);
        try {
          return await app.vault.read(file);
        } finally {
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
        }
      }
    });

    expect(result).toContain('```js');
    expect(result).toContain('console.log("hello");');
  });
});
