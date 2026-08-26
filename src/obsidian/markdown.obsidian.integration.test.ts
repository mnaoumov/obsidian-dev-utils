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
 * What the `hover-link` a rendered internal link fires carries. Only the serializable half — the
 * `hoverParent` and `targetEl` are checked in-process and reported as booleans.
 */
interface HoverResult {
  readonly hasHoverPopoverSlot: boolean;
  readonly isTargetElTheLink: boolean;
  readonly linkText: null | string;
  readonly source: null | string;
  readonly sourcePath: null | string;
}

/**
 * What the no-folder-note case reports back on top of {@link ClickResult}: that the click left the
 * workspace where it was, and created nothing.
 */
interface NoFolderNoteResult extends ClickResult {
  readonly activeFilePathBeforeClick: null | string;
  readonly isFolderNoteCreated: boolean;
}

/**
 * What {@link registerLinkHandlers} must leave exactly as it found it: the workspace it was called in,
 * and the vault.
 */
interface RegisterLinkHandlersResult {
  readonly activeFilePathAfter: null | string;
  readonly activeFilePathBefore: null | string;
  readonly activeLeafChangeCount: number;
  readonly fileCountAfter: number;
  readonly fileCountBefore: number;
  readonly fileOpenCount: number;
  readonly isTemporaryFileLeftBehind: boolean;
  readonly leafCountAfter: number;
  readonly leafCountBefore: number;
}

/**
 * A live recording of what the file explorer was asked to reveal, and the undo for it.
 */
interface RevealRecorder {
  restore(): void;
  revealedPaths: string[];
}

interface WaitArguments {
  readonly nothingHappensTimeoutInMilliseconds: number;
}

type WaitInput = GenericObject<WaitArguments>;

/**
 * How long to give a click that must NOT open anything. There is no readiness signal for something that
 * never happens, so a negative assertion is the one case a bounded wait is the only option — sized well
 * above the settle {@link renderInternalLink} waits before opening.
 */
const NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS = 1000;

/**
 * How long to give {@link registerLinkHandlers} to misbehave. Same shape of negative assertion as
 * {@link NOTHING_OPENS_TIMEOUT_IN_MILLISECONDS}: the implementation this replaced opened its leaf
 * asynchronously (measured at ~685 ms on Android, less on desktop), so the wait has to outlast the
 * window it needed, or the assertion would pass without the fix.
 */
const NOTHING_HAPPENS_TIMEOUT_IN_MILLISECONDS = 1500;

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

  describe('registerLinkHandlers', () => {
    it('should create no leaf, disturb no active leaf and write no file', async () => {
      const result = await evalInObsidian<WaitInput, RegisterLinkHandlersResult>({
        async callback({
          app,
          lib: { registerLinkHandlers },
          nothingHappensTimeoutInMilliseconds
        }) {
          // Declared inside the closure, which is serialized whole — a module-scope helper would not
          // Travel with it.
          function countLeaves(): number {
            let count = 0;
            app.workspace.iterateAllLeaves(() => {
              count++;
            });
            return count;
          }

          let activeLeafChangeCount = 0;
          let fileOpenCount = 0;
          const activeLeafChangeEventRef = app.workspace.on('active-leaf-change', () => {
            activeLeafChangeCount++;
          });
          const fileOpenEventRef = app.workspace.on('file-open', () => {
            fileOpenCount++;
          });

          try {
            const activeFilePathBefore = app.workspace.getActiveFile()?.path ?? null;
            const leafCountBefore = countLeaves();
            const fileCountBefore = app.vault.getFiles().length;

            registerLinkHandlers({ app, el: createSpan() });

            // A negative assertion has no readiness signal to wait on — only a bound generous enough
            // That the leaf-opening this replaced would have happened by now.
            await sleep(nothingHappensTimeoutInMilliseconds);

            return {
              activeFilePathAfter: app.workspace.getActiveFile()?.path ?? null,
              activeFilePathBefore,
              activeLeafChangeCount,
              fileCountAfter: app.vault.getFiles().length,
              fileCountBefore,
              fileOpenCount,
              isTemporaryFileLeftBehind: app.vault.getAbstractFileByPath('__temp.md') !== null,
              leafCountAfter: countLeaves(),
              leafCountBefore
            };
          } finally {
            app.workspace.offref(activeLeafChangeEventRef);
            app.workspace.offref(fileOpenEventRef);
          }
        },
        input: { nothingHappensTimeoutInMilliseconds: NOTHING_HAPPENS_TIMEOUT_IN_MILLISECONDS }
      });

      expect(result.leafCountAfter).toBe(result.leafCountBefore);
      expect(result.activeFilePathAfter).toBe(result.activeFilePathBefore);
      expect(result.activeLeafChangeCount).toBe(0);
      expect(result.fileOpenCount).toBe(0);
      expect(result.fileCountAfter).toBe(result.fileCountBefore);
      expect(result.isTemporaryFileLeftBehind).toBe(false);
    });

    it('should fire hover-link for an internal link', async () => {
      const result = await evalInObsidian<Record<string, never>, HoverResult>({
        async callback({
          app,
          lib: { hoverElement, renderInternalLink, waitUntil }
        }) {
          const HOVER_LINK_TIMEOUT_IN_MILLISECONDS = 5000;

          const file = await app.vault.create('rlh-hover.md', '');
          const aEl = await renderInternalLink({ app, pathOrAbstractFile: file });
          // A trusted hover hit-tests for real, so the link has to genuinely be the topmost element at
          // Its own coordinates — floated above the app rather than appended into the page flow, where
          // Obsidian's own absolutely-positioned containers would cover it.
          aEl.setCssStyles({
            left: '10px',
            position: 'fixed',
            top: '10px',
            zIndex: '9999'
          });
          document.body.append(aEl);

          let hasHoverPopoverSlot = false;
          let isTargetElTheLink = false;
          let linkText = null as null | string;
          let source = null as null | string;
          let sourcePath = null as null | string;
          const hoverLinkEventRef = app.workspace.on('hover-link', (hoverLink) => {
            hasHoverPopoverSlot = 'hoverPopover' in hoverLink.hoverParent;
            isTargetElTheLink = hoverLink.targetEl === aEl;
            linkText = hoverLink.linktext;
            source = hoverLink.source;
            sourcePath = hoverLink.sourcePath ?? null;
          });

          try {
            // A real pointer move over the link, so the `mouseover` that reaches the handler is the one
            // A user produces. `trigger` itself is synchronous, but the trusted event arrives on a later
            // Task than the call that injected it, so the payload has to be awaited.
            await hoverElement({ element: aEl });
            await waitUntil({
              message: 'the hover-link event to fire for the hovered link',
              predicate: () => linkText !== null,
              timeoutInMilliseconds: HOVER_LINK_TIMEOUT_IN_MILLISECONDS
            });
            return {
              hasHoverPopoverSlot,
              isTargetElTheLink,
              linkText,
              source,
              sourcePath
            };
          } finally {
            app.workspace.offref(hoverLinkEventRef);
            aEl.detach();
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(file);
          }
        }
      });

      expect(result.source).toBe('preview');
      expect(result.linkText).toBe('rlh-hover.md');
      expect(result.sourcePath).toBe('');
      expect(result.isTargetElTheLink).toBe(true);
      // The hover parent is the library's own info object — which is what applies the popover z-index
      // Fix on top of a modal.
      expect(result.hasHoverPopoverSlot).toBe(true);
    });

    it('should open an external link\'s URL', async () => {
      const openedUrl = await evalInObsidian<Record<string, never>, null | string>({
        async callback({
          app,
          lib: { renderExternalLink }
        }) {
          let requestedUrl = null as null | string;
          // Held in a local so the restore below assigns through a binding that cannot have moved.
          const win = window;
          const originalOpen = win.open.bind(win);
          win.open = (url?: string | URL): null => {
            requestedUrl = url?.toString() ?? null;
            return null;
          };

          try {
            const aEl = await renderExternalLink({ app, url: 'https://example.com/rlh-external' });
            document.body.append(aEl);
            aEl.click();
            aEl.detach();
            return requestedUrl;
          } finally {
            win.open = originalOpen;
          }
        }
      });

      expect(openedUrl).toBe('https://example.com/rlh-external');
    });

    it('should open the global search for a tag', async () => {
      const requestedQuery = await evalInObsidian<Record<string, never>, null | string>({
        async callback({
          app,
          lib: {
            ensureNonNullable,
            fullRender
          }
        }) {
          const globalSearch = ensureNonNullable(app.internalPlugins.getEnabledPluginById('global-search'));
          let query = null as null | string;
          const originalOpenGlobalSearch = globalSearch.openGlobalSearch.bind(globalSearch);
          // Deliberately NOT calling through: opening the search pane would mutate the shared
          // Workspace every other case in this file measures.
          globalSearch.openGlobalSearch = (search: string): void => {
            query = search;
          };

          const el = createDiv();
          document.body.append(el);

          try {
            await fullRender({
              app,
              el,
              markdown: '#rlh-tag',
              shouldRegisterLinkHandlers: true
            });
            el.find('a.tag').click();
            return query;
          } finally {
            globalSearch.openGlobalSearch = originalOpenGlobalSearch;
            el.detach();
          }
        }
      });

      expect(requestedQuery).toBe('tag:#rlh-tag');
    });
  });

  describe('renderInternalLink', () => {
    it('should open the note a file link names', async () => {
      const openedPath = await evalInObsidian<Record<string, never>, null | string>({
        async callback({
          app,
          lib: {
            renderInternalLink,
            waitUntil
          }
        }) {
          const file = await app.vault.create('rif-open.md', '# opened\n');

          try {
            const aEl = await renderInternalLink({ app, pathOrAbstractFile: file });
            document.body.append(aEl);
            aEl.click();
            await waitUntil({
              message: `the file link should have opened ${file.path}`,
              predicate: () => app.workspace.getActiveFile()?.path === file.path
            });
            aEl.detach();
            return app.workspace.getActiveFile()?.path ?? null;
          } finally {
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(file);
          }
        }
      });

      expect(openedPath).toBe('rif-open.md');
    });

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
