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

interface DirtyEditorResult {
  readonly diskContent: string;
  readonly editorContent: string;
  readonly isDirtyAfter: boolean;
  readonly isDirtyBefore: boolean;
  readonly saveCallCount: number;
  readonly startLine: null | number;
}

interface ReadNoteContent {
  content: string;
}
type ReadNoteContentArguments = GenericObject<ReadNoteContent>;

describe('markdown-code-block-processor', () => {
  it('should read note content with code block from vault', async () => {
    const content = `${dedent`
      # Test Note

      \`\`\`js
      console.log("hello");
      \`\`\`
    `}\n`;
    const result = await evalInObsidian<ReadNoteContentArguments, string>({
      async callback({ app, content: noteContent }) {
        const file = await app.vault.create('code-block-test.md', noteContent);
        try {
          return await app.vault.read(file);
        } finally {
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
        }
      },
      input: { content }
    });

    expect(result).toContain('```js');
    expect(result).toContain('console.log("hello");');
  });

  it('should locate a code block in a dirty editor without saving the note', async () => {
    const savedContent = `${dedent`
      # Note

      \`\`\`js
      console.log(1);
      \`\`\`
    `}\n`;
    const result = await evalInObsidian({
      async callback({ app, lib: { castTo, getCodeBlockMarkdownInfo }, obsidianModule, savedContent: noteContent }): Promise<DirtyEditorResult> {
        const { MarkdownView } = obsidianModule;
        const notePath = 'code-block-dirty-editor.md';

        const file = await app.vault.create(notePath, noteContent);
        const leaf = app.workspace.getLeaf(true);
        try {
          await leaf.openFile(file);
          const view = leaf.view;
          if (!(view instanceof MarkdownView)) {
            throw new TypeError('expected a MarkdownView');
          }

          // An unsaved edit above the block, as a user typing while the block re-renders.
          view.editor.replaceRange('added line\n', { ch: 0, line: 0 });
          const isDirtyBefore = view.dirty;

          let saveCallCount = 0;
          const originalSave = view.save.bind(view);
          view.save = async (shouldClear?: boolean): Promise<void> => {
            saveCallCount++;
            await originalSave(shouldClear);
          };

          const markdownInfo = await getCodeBlockMarkdownInfo({
            app,
            context: castTo<Parameters<typeof getCodeBlockMarkdownInfo>[0]['context']>({ sourcePath: notePath }),
            el: createDiv({ cls: 'block-language-js' }),
            source: 'console.log(1);'
          });

          return {
            diskContent: await app.vault.adapter.read(notePath),
            editorContent: view.editor.getValue(),
            isDirtyAfter: view.dirty,
            isDirtyBefore,
            saveCallCount,
            startLine: markdownInfo?.positionInNote.start.line ?? null
          };
        } finally {
          leaf.detach();
          if (await app.vault.adapter.exists(notePath)) {
            await app.vault.adapter.trashLocal(notePath);
          }
        }
      },
      input: { savedContent }
    });

    expect(result.isDirtyBefore).toBe(true);
    expect(result.saveCallCount).toBe(0);
    expect(result.isDirtyAfter).toBe(true);
    expect(result.diskContent).toBe(savedContent);
    // Located in the editor's text, where the unsaved line moved the block down by one.
    expect(result.editorContent).toBe(`added line\n${savedContent}`);
    expect(result.startLine).toBe(3);
  });

  it('should save a dirty editor and then replace the code block', async () => {
    const savedContent = `${dedent`
      # Note

      \`\`\`js
      console.log(1);
      \`\`\`
    `}\n`;
    const diskContent = await evalInObsidian({
      async callback({ app, lib: { castTo, replaceCodeBlock }, obsidianModule, savedContent: noteContent }): Promise<string> {
        const { MarkdownView } = obsidianModule;
        const notePath = 'code-block-dirty-editor-replace.md';

        const file = await app.vault.create(notePath, noteContent);
        const leaf = app.workspace.getLeaf(true);
        try {
          await leaf.openFile(file);
          const view = leaf.view;
          if (!(view instanceof MarkdownView)) {
            throw new TypeError('expected a MarkdownView');
          }

          view.editor.replaceRange('added line\n', { ch: 0, line: 0 });

          await replaceCodeBlock({
            app,
            codeBlockProvider: '```js\nconsole.log(2);\n```',
            context: castTo<Parameters<typeof replaceCodeBlock>[0]['context']>({ sourcePath: notePath }),
            el: createDiv({ cls: 'block-language-js' }),
            resourceLockComponent: null,
            source: 'console.log(1);'
          });

          return await app.vault.adapter.read(notePath);
        } finally {
          leaf.detach();
          if (await app.vault.adapter.exists(notePath)) {
            await app.vault.adapter.trashLocal(notePath);
          }
        }
      },
      input: { savedContent }
    });

    // The unsaved line was flushed first, so the file's content matched and the write went through.
    expect(diskContent).toBe(`added line\n${savedContent.replace('console.log(1);', 'console.log(2);')}`);
  });
});
