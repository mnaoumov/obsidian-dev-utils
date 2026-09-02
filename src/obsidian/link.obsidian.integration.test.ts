/**
 * @file
 *
 * Integration tests for link editing against a real Obsidian instance.
 *
 * The `file://` cases confirm the end-to-end round-trip (real metadata parse -> link selection ->
 * converter -> frontmatter/body write-back) normalizes `file://` links in BOTH the note body and
 * frontmatter values.
 *
 * The offset-range cases confirm the range filter against positions produced by Obsidian's own parser
 * rather than hand-built fixtures, and pin the contract a selection command depends on: a range taken
 * from an UNSAVED editor buffer is valid, because the buffer is flushed to disk before the content is
 * read.
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

/**
 * Result of the dirty-editor-buffer offset-range test.
 */
interface OffsetRangeFromEditorResult {
  readonly diskAfterEdit: string;
  readonly selectedEndOffset: number;
  readonly selectedStartOffset: number;
}

describe('file:// link normalization', () => {
  it('should normalize file:// links in both frontmatter and body', async () => {
    const { result } = await evalInObsidian<Record<string, never>, NormalizeResult>({
      async callback({ app, lib: { updateFileUrlLinksInContent } }) {
        const content = '---\nurl: file:///F:%5Cover%5Care.txt\n---\n\n[body](file:///F:%5Cover%5Cage.txt)\n';
        const normalized = await updateFileUrlLinksInContent({ app, content });
        return { result: normalized };
      }
    });

    expect(result).toContain('file:///F:/over/are.txt');
    expect(result).toContain('[body](file:///F:/over/age.txt)');
    expect(result).not.toContain('%5C');
  });

  it('should normalize each file:// link within a multi-link frontmatter value', async () => {
    const { result } = await evalInObsidian<Record<string, never>, NormalizeResult>({
      async callback({ app, lib: { updateFileUrlLinksInContent } }) {
        const content = '---\nurls: "file:///F:%5Ca%5Cx.txt file:///F:%5Cb%5Cy.txt"\n---\n';
        const normalized = await updateFileUrlLinksInContent({ app, content });
        return { result: normalized };
      }
    });

    expect(result).toContain('file:///F:/a/x.txt');
    expect(result).toContain('file:///F:/b/y.txt');
    expect(result).not.toContain('%5C');
  });
});

describe('offset range', () => {
  it('should rewrite only the link fully contained in the range, against real parsed positions', async () => {
    const { result } = await evalInObsidian<Record<string, never>, NormalizeResult>({
      async callback({ app, lib: { editLinksInContent } }) {
        const content = '[[alpha]] [[bravo]] [[charlie]]\n';
        // `[[bravo]]` spans exactly 10-19, so this also pins the inclusive bounds.
        const edited = await editLinksInContent({
          app,
          content,
          linkConverter: (link) => `[[new-${link.link}]]`,
          offsetRange: { endOffset: 19, startOffset: 10 }
        });
        return { result: edited };
      }
    });

    expect(result).toBe('[[alpha]] [[new-bravo]] [[charlie]]\n');
  });

  it('should honour a range taken from a dirty editor buffer, because the buffer is flushed before reading', async () => {
    const result = await evalInObsidian<Record<string, never>, OffsetRangeFromEditorResult>({
      async callback({ app, lib: { editLinks }, obsidianModule }) {
        const { MarkdownView } = obsidianModule;
        const targetPath = 't883-offset-range.md';
        const diskContent = '[[alpha]] [[bravo]] [[charlie]]\n';
        // The buffer gains a heading, shifting every link 7 characters past its on-disk offset.
        const bufferContent = `# T883\n${diskContent}`;

        const file = await app.vault.create(targetPath, diskContent);
        const leaf = app.workspace.getLeaf(true);
        try {
          await leaf.openFile(file);
          const view = leaf.view;
          if (!(view instanceof MarkdownView)) {
            throw new TypeError('expected a MarkdownView');
          }
          const editor = view.editor;

          // Mimic a consumer that typed into the note and has not saved: disk and buffer now disagree.
          editor.setValue(bufferContent);

          // Select `[[bravo]]` the way a selection command does, then convert the selection to offsets.
          const bravoStart = bufferContent.indexOf('[[bravo]]');
          editor.setSelection(editor.offsetToPos(bravoStart), editor.offsetToPos(bravoStart + '[[bravo]]'.length));
          const selectedStartOffset = editor.posToOffset(editor.getCursor('from'));
          const selectedEndOffset = editor.posToOffset(editor.getCursor('to'));

          await editLinks({
            app,
            linkConverter: (link) => `[[new-${link.link}]]`,
            offsetRange: { endOffset: selectedEndOffset, startOffset: selectedStartOffset },
            pathOrFile: file,
            pluginNoticeComponent: null,
            resourceLockComponent: null,
            timeoutInMilliseconds: 10_000
          });

          return {
            diskAfterEdit: await app.vault.adapter.read(targetPath),
            selectedEndOffset,
            selectedStartOffset
          };
        } finally {
          leaf.detach();
          if (await app.vault.adapter.exists(targetPath)) {
            await app.vault.adapter.trashLocal(targetPath);
          }
        }
      }
    });

    // The offsets are the BUFFER's, 7 past the on-disk ones — applying them to the stale disk content
    // would have matched no link at all.
    expect(result.selectedStartOffset).toBe(17);
    expect(result.selectedEndOffset).toBe(26);
    expect(result.diskAfterEdit).toBe('# T883\n[[alpha]] [[new-bravo]] [[charlie]]\n');
  });
});
