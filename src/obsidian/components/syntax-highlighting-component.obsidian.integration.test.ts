/**
 * @file
 *
 * Integration tests verifying that {@link SyntaxHighlightingComponent} reaches the two REAL Obsidian
 * highlighting registries — the CodeMirror 5 mode registry that drives fences in the editor, and Prism,
 * which drives them in reading view — and that unloading the component leaves both rendering cleanly.
 *
 * The unit tests drive fake registries, so they can only prove the component writes what it says it writes.
 * They cannot answer the question this suite exists for: whether REMOVING the CodeMirror 5 mode on unload
 * leaves a fence rendering as plain text, or whether CodeMirror's `getMode` needs the entry to stay present
 * (in which case the component would have to keep the pre-existing plugins' workaround of redefining the
 * mode to `null` instead of deleting it). That could not be settled from the minified Obsidian bundle.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface EditorHighlightingResult {
  readonly hasModeAfterUnload: boolean;
  readonly hasModeWhileRegistered: boolean;
  readonly isHighlightedAfterUnload: boolean;
  readonly isHighlightedBeforeRegistration: boolean;
  readonly isHighlightedWhileRegistered: boolean;
  readonly textAfterUnload: string;
}

interface ReadingViewHighlightingResult {
  readonly isHighlightedAfterUnload: boolean;
  readonly isHighlightedWhileRegistered: boolean;
  readonly textAfterUnload: string;
}

const FENCE_CODE = 'const syntaxHighlightingTest = 1;';

describe('SyntaxHighlightingComponent', () => {
  it('should highlight a fence in the editor while registered and render it cleanly after unload', async () => {
    const result = await evalInObsidian<Record<string, never>, EditorHighlightingResult>({
      async fn({ app, lib: { SyntaxHighlightingComponent, waitUntil } }) {
        const LANGUAGE = 'odu-syntax-highlighting-editor-test';
        const CODE = 'const syntaxHighlightingTest = 1;';
        const WAIT_TIMEOUT_IN_MILLISECONDS = 10_000;
        const SETTLE_IN_MILLISECONDS = 2000;
        const file = await app.vault.create(
          'syntax-highlighting-component-editor-integration.md',
          `\`\`\`${LANGUAGE}\n${CODE}\n\`\`\`\n`
        );
        const component = new SyntaxHighlightingComponent();
        const leaf = app.workspace.getLeaf(false);

        try {
          const isHighlightedBeforeRegistration = await checkIsHighlightedAsync(false);

          component.load();
          await component.registerCodeBlockLanguage({
            editorMode: 'text/typescript',
            language: LANGUAGE
          });
          const hasModeWhileRegistered = LANGUAGE in window.CodeMirror.modes;
          const isHighlightedWhileRegistered = await checkIsHighlightedAsync(true);

          component.unload();
          const hasModeAfterUnload = LANGUAGE in window.CodeMirror.modes;
          const isHighlightedAfterUnload = await checkIsHighlightedAsync(false);
          const textAfterUnload = readCodeLineElement()?.textContent ?? '';

          return {
            hasModeAfterUnload,
            hasModeWhileRegistered,
            isHighlightedAfterUnload,
            isHighlightedBeforeRegistration,
            isHighlightedWhileRegistered,
            textAfterUnload
          };
        } finally {
          component.unload();
          app.workspace.detachLeavesOfType('markdown');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
        }

        // A highlighted fence splits into token spans (`cm-keyword`, `cm-def`, ...); an unhighlighted one
        // Stays a single `cm-hmd-codeblock` span.
        function checkHasKeywordToken(): boolean {
          return (readCodeLineElement()?.querySelector('.cm-keyword') ?? null) !== null;
        }

        // `isHighlightingExpected` decides HOW to wait, because the two directions need different waits:
        // Waiting for the token IS the assertion when highlighting is expected, while its ABSENCE can only
        // Be asserted after a settle long enough for a late token to have shown up.
        async function checkIsHighlightedAsync(isHighlightingExpected: boolean): Promise<boolean> {
          await rebuildViewAsync();

          if (isHighlightingExpected) {
            await waitUntil({
              message: 'the fence should be tokenized by the registered editor mode',
              predicate: checkHasKeywordToken,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });
          } else {
            await sleep(SETTLE_IN_MILLISECONDS);
          }

          return checkHasKeywordToken();
        }

        function readCodeLineElement(): Element | null {
          const lineEls = Array.from(leaf.view.containerEl.querySelectorAll('.cm-content .cm-line'));
          return lineEls.find((lineElement) => lineElement.textContent.includes(CODE)) ?? null;
        }

        // Rebuilds the view from scratch so the fence is tokenized against the CURRENT mode registry,
        // Instead of relying on a live re-parse of an already-open editor.
        async function rebuildViewAsync(): Promise<void> {
          await leaf.setViewState({ type: 'empty' });
          await leaf.openFile(file, { state: { mode: 'source', source: false } });
          await app.workspace.revealLeaf(leaf);
          await waitUntil({
            message: 'the fence line should render in the editor',
            predicate: () => readCodeLineElement() !== null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
        }
      }
    });

    // The registered CodeMirror 5 mode actually tokenizes the fence in the editor.
    expect(result.hasModeWhileRegistered).toBe(true);
    expect(result.isHighlightedBeforeRegistration).toBe(false);
    expect(result.isHighlightedWhileRegistered).toBe(true);

    // Unloading removes the mode, and the fence still renders its text — no error, no stale highlighting.
    expect(result.hasModeAfterUnload).toBe(false);
    expect(result.isHighlightedAfterUnload).toBe(false);
    expect(result.textAfterUnload).toContain(FENCE_CODE);
  });

  it('should highlight a fence in reading view while registered and drop the grammar after unload', async () => {
    const result = await evalInObsidian<Record<string, never>, ReadingViewHighlightingResult>({
      async fn({ app, lib: { SyntaxHighlightingComponent, waitUntil } }) {
        const LANGUAGE = 'odu-syntax-highlighting-reading-view-test';
        const CODE = 'const syntaxHighlightingTest = 1;';
        const WAIT_TIMEOUT_IN_MILLISECONDS = 10_000;
        const SETTLE_IN_MILLISECONDS = 2000;
        const file = await app.vault.create(
          'syntax-highlighting-component-reading-view-integration.md',
          `\`\`\`${LANGUAGE}\n${CODE}\n\`\`\`\n`
        );
        const component = new SyntaxHighlightingComponent();
        const leaf = app.workspace.getLeaf(false);

        try {
          component.load();
          await component.registerCodeBlockLanguage({
            editorMode: 'text/typescript',
            language: LANGUAGE,
            prismGrammar: 'typescript'
          });
          const isHighlightedWhileRegistered = await checkIsHighlightedAsync(true);

          component.unload();
          const isHighlightedAfterUnload = await checkIsHighlightedAsync(false);
          const textAfterUnload = readCodeElement()?.textContent ?? '';

          return {
            isHighlightedAfterUnload,
            isHighlightedWhileRegistered,
            textAfterUnload
          };
        } finally {
          component.unload();
          app.workspace.detachLeavesOfType('markdown');
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
        }

        // Prism wraps every matched construct in a `.token` span.
        function checkHasPrismToken(): boolean {
          return (readCodeElement()?.querySelector('.token') ?? null) !== null;
        }

        // Same asymmetry as the editor test: the wait IS the assertion when tokens are expected, while
        // Their absence is only meaningful after a settle long enough for a late token to have shown up.
        async function checkIsHighlightedAsync(isHighlightingExpected: boolean): Promise<boolean> {
          await rebuildViewAsync();

          if (isHighlightingExpected) {
            await waitUntil({
              message: 'the fence should be tokenized by the registered Prism grammar',
              predicate: checkHasPrismToken,
              timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
            });
          } else {
            await sleep(SETTLE_IN_MILLISECONDS);
          }

          return checkHasPrismToken();
        }

        function readCodeElement(): Element | null {
          const codeEls = Array.from(leaf.view.containerEl.querySelectorAll('.markdown-preview-view pre > code'));
          return codeEls.find((codeElement) => codeElement.textContent.includes(CODE)) ?? null;
        }

        // Rebuilds the reading view from scratch so the fence is highlighted against the CURRENT Prism
        // Registry, instead of relying on a live re-render of an already-rendered preview.
        async function rebuildViewAsync(): Promise<void> {
          await leaf.setViewState({ type: 'empty' });
          await leaf.openFile(file, { state: { mode: 'preview' } });
          await app.workspace.revealLeaf(leaf);
          await waitUntil({
            message: 'the fence should render in reading view',
            predicate: () => readCodeElement() !== null,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
        }
      }
    });

    // The registered Prism grammar actually tokenizes the fence in reading view.
    expect(result.isHighlightedWhileRegistered).toBe(true);

    // Unloading removes the grammar, so the fence renders its text without tokens again.
    expect(result.isHighlightedAfterUnload).toBe(false);
    expect(result.textAfterUnload).toContain(FENCE_CODE);
  });
});
