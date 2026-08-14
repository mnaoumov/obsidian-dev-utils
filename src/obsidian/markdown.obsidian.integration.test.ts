/**
 * @file
 *
 * Integration tests for the Markdown utility functions.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type { TAbstractFile } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

/**
 * What every folder-link case reports back: what the click opened, and what it highlighted.
 */
interface ClickResult {
  readonly openedPath: null | string;
  readonly revealedPaths: readonly string[];
}

interface FolderNoteArguments {
  readonly folderPath: string;
  readonly nothingOpensTimeoutInMilliseconds: number;
  readonly shouldHideFolderNote: boolean;
}

type FolderNoteInput = GenericObject<FolderNoteArguments>;

/**
 * What the no-folder-note case reports back on top of {@link ClickResult}: that the click left the
 * workspace where it was, and created nothing.
 */
interface NoFolderNoteResult extends ClickResult {
  readonly activeFilePathBeforeClick: null | string;
  readonly isFolderNoteCreated: boolean;
}

/**
 * A live recording of what the file explorer was asked to reveal, and the undo for it.
 */
interface RevealRecorder {
  restore(): void;
  revealedPaths: string[];
}

/**
 * How long to give a click that must NOT open anything. There is no readiness signal for something that
 * never happens, so a negative assertion is the one case a bounded wait is the only option — sized well
 * above the settle {@link renderInternalLink} waits before opening.
 */
const NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS = 1000;

describe('markdown', () => {
  describe('markdownToHtml', () => {
    it('should convert simple markdown to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        callback({ app, lib: { markdownToHtml } }) {
          return markdownToHtml({ app, markdown: '**bold** and *italic*' });
        }
      });

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should convert headings to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        callback({ app, lib: { markdownToHtml } }) {
          return markdownToHtml({ app, markdown: '# Heading 1\n## Heading 2' });
        }
      });

      expect(result).toContain('Heading 1');
      expect(result).toContain('Heading 2');
    });

    it('should convert a list to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        callback({ app, lib: { markdownToHtml } }) {
          return markdownToHtml({ app, markdown: '- item 1\n- item 2\n- item 3' });
        }
      });

      expect(result).toContain('<li');
      expect(result).toContain('item 1');
      expect(result).toContain('item 2');
      expect(result).toContain('item 3');
    });

    it('should convert inline code to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        callback({ app, lib: { markdownToHtml } }) {
          return markdownToHtml({ app, markdown: 'use `console.log()` here' });
        }
      });

      expect(result).toContain('<code>');
      expect(result).toContain('console.log()');
    });

    it('should handle empty markdown', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        callback({ app, lib: { markdownToHtml } }) {
          return markdownToHtml({ app, markdown: '' });
        }
      });

      expect(result).toBe('');
    });
  });

  describe('fullRender', () => {
    it('should render markdown into an element', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        async callback({ app, lib: { fullRender } }) {
          const element = createDiv();
          await fullRender({
            app,
            el: element,
            markdown: 'Hello **world**'
          });
          return element.innerHTML;
        }
      });

      expect(result).toContain('<strong>world</strong>');
      expect(result).toContain('Hello');
    });
  });

  describe('renderInternalLink', () => {
    it('should open a folder\'s folder note and reveal that note', async () => {
      const result = await clickFolderLink('rif-with-note', false);

      expect(result.openedPath).toBe('rif-with-note/rif-with-note.md');
      expect(result.revealedPaths).toStrictEqual(['rif-with-note/rif-with-note.md']);
    });

    it('should reveal the folder instead when the folder note is hidden', async () => {
      const result = await clickFolderLink('rif-hidden-note', true);

      expect(result.openedPath).toBe('rif-hidden-note/rif-hidden-note.md');
      expect(result.revealedPaths).toStrictEqual(['rif-hidden-note']);
    });

    it('should only reveal a folder that has no folder note, creating nothing', async () => {
      const result = await evalInObsidian<FolderNoteInput, NoFolderNoteResult>({
        async callback({
          app,
          folderPath,
          lib: {
            ensureNonNullable,
            renderInternalLink
          },
          nothingOpensTimeoutInMilliseconds
        }) {
          // Declared inside the closure, which is serialized whole — a module-scope helper would not
          // Travel with it.
          function recordReveals(): RevealRecorder {
            const fileExplorer = ensureNonNullable(app.internalPlugins.getEnabledPluginById('file-explorer'));
            const revealedPaths: string[] = [];
            const originalRevealInFolder = fileExplorer.revealInFolder;
            fileExplorer.revealInFolder = (abstractFile: TAbstractFile): void => {
              revealedPaths.push(abstractFile.path);
              originalRevealInFolder.call(fileExplorer, abstractFile);
            };
            return {
              restore: (): void => {
                fileExplorer.revealInFolder = originalRevealInFolder;
              },
              revealedPaths
            };
          }

          const activeFilePathBeforeClick = app.workspace.getActiveFile()?.path ?? null;
          const folder = await app.vault.createFolder(folderPath);
          const { restore, revealedPaths } = recordReveals();

          try {
            const aEl = await renderInternalLink({ app, pathOrAbstractFile: folder });
            aEl.click();
            // A negative assertion: nothing here is going to open, so there is no readiness signal to
            // Wait on — only a bound generous enough that an open would have happened by now.
            await sleep(nothingOpensTimeoutInMilliseconds);

            return {
              activeFilePathBeforeClick,
              isFolderNoteCreated: app.vault.getAbstractFileByPath(`${folderPath}/${folderPath}.md`) !== null,
              openedPath: app.workspace.getActiveFile()?.path ?? null,
              revealedPaths
            };
          } finally {
            restore();
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(folder, true);
          }
        },
        input: {
          folderPath: 'rif-no-note',
          nothingOpensTimeoutInMilliseconds: NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS,
          shouldHideFolderNote: false
        }
      });

      expect(result.isFolderNoteCreated).toBe(false);
      expect(result.openedPath).toBe(result.activeFilePathBeforeClick);
      expect(result.revealedPaths).toStrictEqual(['rif-no-note']);
    });

    it('should reveal the file a file link names', async () => {
      const result = await evalInObsidian<FolderNoteInput, ClickResult>({
        async callback({
          app,
          folderPath,
          lib: {
            ensureNonNullable,
            renderInternalLink,
            waitUntil
          }
        }) {
          // See the sibling case for why this is declared inside the closure.
          function recordReveals(): RevealRecorder {
            const fileExplorer = ensureNonNullable(app.internalPlugins.getEnabledPluginById('file-explorer'));
            const revealedPaths: string[] = [];
            const originalRevealInFolder = fileExplorer.revealInFolder;
            fileExplorer.revealInFolder = (abstractFile: TAbstractFile): void => {
              revealedPaths.push(abstractFile.path);
              originalRevealInFolder.call(fileExplorer, abstractFile);
            };
            return {
              restore: (): void => {
                fileExplorer.revealInFolder = originalRevealInFolder;
              },
              revealedPaths
            };
          }

          const file = await app.vault.create(`${folderPath}.md`, '');
          const { restore, revealedPaths } = recordReveals();

          try {
            const aEl = await renderInternalLink({
              app,
              pathOrAbstractFile: file,
              shouldRevealFile: true
            });
            document.body.append(aEl);
            aEl.click();
            await waitUntil({
              message: `the file link should have revealed ${file.path}`,
              predicate: () => revealedPaths.includes(file.path)
            });
            aEl.detach();

            return {
              openedPath: app.workspace.getActiveFile()?.path ?? null,
              revealedPaths
            };
          } finally {
            restore();
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(file);
          }
        },
        input: {
          folderPath: 'rif-file',
          nothingOpensTimeoutInMilliseconds: NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS,
          shouldHideFolderNote: false
        }
      });

      expect(result.revealedPaths).toStrictEqual(['rif-file.md']);
    });
  });
});

/**
 * Renders a link to a folder that HAS a folder note, clicks it, and reports what the click did.
 *
 * @param folderPath - The folder to create; its folder note is named after it.
 * @param shouldHideFolderNote - Whether the folder note counts as hidden in the explorer.
 * @returns What the click opened and revealed.
 */
async function clickFolderLink(folderPath: string, shouldHideFolderNote: boolean): Promise<ClickResult> {
  return await evalInObsidian<FolderNoteInput, ClickResult>({
    async callback({
      app,
      folderPath: path,
      lib: {
        ensureNonNullable,
        FolderNoteLocation,
        renderInternalLink,
        waitUntil
      },
      shouldHideFolderNote: isHidden
    }) {
      // See the sibling cases for why this is declared inside the closure.
      function recordReveals(): RevealRecorder {
        const fileExplorer = ensureNonNullable(app.internalPlugins.getEnabledPluginById('file-explorer'));
        const revealedPaths: string[] = [];
        const originalRevealInFolder = fileExplorer.revealInFolder;
        fileExplorer.revealInFolder = (abstractFile: TAbstractFile): void => {
          revealedPaths.push(abstractFile.path);
          originalRevealInFolder.call(fileExplorer, abstractFile);
        };
        return {
          restore: (): void => {
            fileExplorer.revealInFolder = originalRevealInFolder;
          },
          revealedPaths
        };
      }

      const folder = await app.vault.createFolder(path);
      const folderNote = await app.vault.create(`${path}/${path}.md`, '# folder note\n');
      const { restore, revealedPaths } = recordReveals();

      try {
        const aEl = await renderInternalLink({
          app,
          folderNote: {
            isHidden,
            location: FolderNoteLocation.InsideFolder
          },
          pathOrAbstractFile: folder
        });
        aEl.click();
        await waitUntil({
          message: `the folder link should have opened ${folderNote.path}`,
          predicate: () => app.workspace.getActiveFile()?.path === folderNote.path
        });

        return {
          openedPath: app.workspace.getActiveFile()?.path ?? null,
          revealedPaths
        };
      } finally {
        restore();
        // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
        await app.vault.delete(folder, true);
      }
    },
    input: {
      folderPath,
      nothingOpensTimeoutInMilliseconds: NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS,
      shouldHideFolderNote
    }
  });
}
