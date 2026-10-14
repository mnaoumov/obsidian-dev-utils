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
      async callback({ app, lib: { SyntaxHighlightingComponent, waitUntil } }) {
        const LANGUAGE = 'odu-syntax-highlighting-editor-test';
        const CODE = 'const syntaxHighlightingTest = 1;';
        /*
         * These are sized by the WORST CASE this closure can reach, not by any one wait: the whole closure
         * runs in a single transport call capped at ~30 s, and a check rebuilds the view before waiting. So
         * the budget is 3 rebuilds + 1 highlight wait + 2 settles = 22 s, which is the figure
         * `no-over-cap-wait-in-eval-in-obsidian` now reads too, since it counts a helper once per CALL SITE.
         * The two directions are SEPARATE helpers for that reason: one branchy helper's `if` and `else` are
         * summed lexically, so both arms would be charged at all three call sites.
         */
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;
        const SETTLE_IN_MILLISECONDS = 1000;
        const file = await app.vault.create(
          'syntax-highlighting-component-editor-integration.md',
          `\`\`\`${LANGUAGE}\n${CODE}\n\`\`\`\n`
        );
        const component = new SyntaxHighlightingComponent();
        const leaf = app.workspace.getLeaf(false);

        try {
          const isHighlightedBeforeRegistration = await checkIsHighlightedAfterSettleAsync();

          component.load();
          await component.registerCodeBlockLanguage({
            editorMode: 'text/typescript',
            language: LANGUAGE
          });
          const hasModeWhileRegistered = Object.hasOwn(window.CodeMirror.modes, LANGUAGE);
          const isHighlightedWhileRegistered = await checkIsHighlightedAfterWaitAsync();

          component.unload();
          const hasModeAfterUnload = Object.hasOwn(window.CodeMirror.modes, LANGUAGE);
          const isHighlightedAfterUnload = await checkIsHighlightedAfterSettleAsync();
          const textAfterUnload = readCodeLineEl()?.textContent ?? '';

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
        // stays a single `cm-hmd-codeblock` span.
        function hasKeywordToken(): boolean {
          return (readCodeLineEl()?.querySelector('.cm-keyword') ?? null) !== null;
        }

        // The ABSENCE of highlighting is only meaningful after a settle long enough for a late token to
        // have shown up, which is why this direction waits a flat interval rather than for a condition.
        async function checkIsHighlightedAfterSettleAsync(): Promise<boolean> {
          await rebuildViewAsync();
          await sleep(SETTLE_IN_MILLISECONDS);
          return hasKeywordToken();
        }

        // When highlighting is expected, waiting for the token IS the assertion.
        async function checkIsHighlightedAfterWaitAsync(): Promise<boolean> {
          await rebuildViewAsync();
          await waitUntil({
            message: 'the fence should be tokenized by the registered editor mode',
            predicate: hasKeywordToken,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          return hasKeywordToken();
        }

        function readCodeLineEl(): Element | null {
          const lineEls = [...leaf.view.containerEl.querySelectorAll(':scope .cm-content .cm-line')];
          return lineEls.find((lineEl) => lineEl.textContent.includes(CODE)) ?? null;
        }

        // Rebuilds the view from scratch so the fence is tokenized against the CURRENT mode registry,
        // instead of relying on a live re-parse of an already-open editor.
        async function rebuildViewAsync(): Promise<void> {
          await leaf.setViewState({ type: 'empty' });
          await leaf.openFile(file, { state: { mode: 'source', source: false } });
          await app.workspace.revealLeaf(leaf);
          await waitUntil({
            message: 'the fence line should render in the editor',
            predicate: () => readCodeLineEl() !== null,
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
      async callback({ app, lib: { SyntaxHighlightingComponent, waitUntil } }) {
        const LANGUAGE = 'odu-syntax-highlighting-reading-view-test';
        const CODE = 'const syntaxHighlightingTest = 1;';
        /*
         * Same worst-case sizing as the editor case above, over two checks rather than three: 2 rebuilds +
         * 1 highlight wait + 1 settle = 16 s, inside the transport's ~30 s cap.
         */
        const WAIT_TIMEOUT_IN_MILLISECONDS = 5000;
        const SETTLE_IN_MILLISECONDS = 1000;
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
          const isHighlightedWhileRegistered = await checkIsHighlightedAfterWaitAsync();

          component.unload();
          const isHighlightedAfterUnload = await checkIsHighlightedAfterSettleAsync();
          const textAfterUnload = readCodeEl()?.textContent ?? '';

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
        function hasPrismToken(): boolean {
          return (readCodeEl()?.querySelector('.token') ?? null) !== null;
        }

        // Same asymmetry as the editor test: the absence of tokens is only meaningful after a settle long
        // enough for a late one to have shown up.
        async function checkIsHighlightedAfterSettleAsync(): Promise<boolean> {
          await rebuildViewAsync();
          await sleep(SETTLE_IN_MILLISECONDS);
          return hasPrismToken();
        }

        // ... while the wait IS the assertion when tokens are expected.
        async function checkIsHighlightedAfterWaitAsync(): Promise<boolean> {
          await rebuildViewAsync();
          await waitUntil({
            message: 'the fence should be tokenized by the registered Prism grammar',
            predicate: hasPrismToken,
            timeoutInMilliseconds: WAIT_TIMEOUT_IN_MILLISECONDS
          });
          return hasPrismToken();
        }

        function readCodeEl(): Element | null {
          const codeEls = [...leaf.view.containerEl.querySelectorAll(':scope .markdown-preview-view pre > code')];
          return codeEls.find((codeEl) => codeEl.textContent.includes(CODE)) ?? null;
        }

        // Rebuilds the reading view from scratch so the fence is highlighted against the CURRENT Prism
        // registry, instead of relying on a live re-render of an already-rendered preview.
        async function rebuildViewAsync(): Promise<void> {
          await leaf.setViewState({ type: 'empty' });
          await leaf.openFile(file, { state: { mode: 'preview' } });
          await app.workspace.revealLeaf(leaf);
          await waitUntil({
            message: 'the fence should render in reading view',
            predicate: () => readCodeEl() !== null,
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
