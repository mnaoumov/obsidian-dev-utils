/**
 * @file
 *
 * Integration tests for {@link MinimizableModal} against a live Obsidian instance.
 *
 * Minimizing a blocking {@link Modal} keeps it open but out of the way so the user can peek at the
 * involved notes — yet the modal's blocking contract must be preserved. These tests confirm the
 * **peek-only lock** in a real Obsidian: while minimized the keyboard is blocked (a trusted keystroke
 * never reaches the editor) and opening another modal is blocked; restoring lifts the lock and the
 * editor is typable again.
 *
 * Typing goes through the `typeIntoEditor` helper that `obsidian-integration-testing` provides on every
 * `evalInObsidian` callback's args, which injects **trusted** Electron keyboard input — so the document
 * changes only if the editor genuinely holds focus AND the keystroke is not suppressed. A suppressed
 * trusted keystroke lands nowhere, making this a faithful end-to-end guard (unlike `execCommand`, which
 * would insert text even while the keystroke is suppressed).
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface HoverOpacityResult {
  readonly alphaWhileHovered: number;
  readonly backgroundColorWhileHovered: string;
}

interface ModalOpenBlockedResult {
  readonly didOpenAfterRestore: boolean;
  readonly didOpenWhileMinimized: boolean;
}

interface RestoreByClickResult {
  readonly barGoneAfterBarClick: boolean;
  readonly barGoneAfterTitleClick: boolean;
  readonly restoredByBarClick: boolean;
  readonly restoredByTitleClick: boolean;
}

interface SettingsPopoutBlockedResult {
  readonly didOpenSettingsAfterRestore: boolean;
  readonly didOpenSettingsWhileMinimized: boolean;
}

interface TypingWhileMinimizedResult {
  readonly didAcceptTypingAfterRestore: boolean;
  readonly didAcceptTypingWhileMinimized: boolean;
  readonly isMinimized: boolean;
}

describe('MinimizableModal', () => {
  describe('minimize', () => {
    it('should block the keyboard while minimized and allow typing again after restore', async () => {
      const result = await evalInObsidian({
        async fn({ app, obsidianModule, typeIntoEditor }): Promise<TypingWhileMinimizedResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          // This file shares its live Obsidian instance with the other integration suites.
          // Start from a clean workspace so only the view this test opens is around.
          app.workspace.detachLeavesOfType('markdown');
          await settle();

          const file = await app.vault.create('minimizable-modal-typing.md', 'hello world');
          const leaf = app.workspace.getLeaf();
          await leaf.openFile(file);
          // The CodeMirror instance is not fully wired up the instant `openFile` resolves.
          await settle();

          // Open a plain blocking modal and wrap it so it can be minimized.
          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await settle();

          // Minimize it: the backdrop is hidden, but the app is peek-only — the keyboard is blocked.
          minimizable.minimize();
          await settle();
          const isMinimized = minimizable.isMinimized;

          // Typing into the editor while the modal is minimized must NOT reach the document.
          // A suppressed trusted keystroke leaves the editor value unchanged.
          const beforeMinimized = readValue();
          await typeIntoEditor({ editor: getEditor(), text: 'X' });
          const didAcceptTypingWhileMinimized = readValue() !== beforeMinimized;

          // Restoring then closing the modal must leave the editor typable again.
          minimizable.restore();
          await settle();
          minimizable.modal.close();
          await settle();
          const beforeRestore = readValue();
          await typeIntoEditor({ editor: getEditor(), text: 'Y' });
          const didAcceptTypingAfterRestore = readValue() !== beforeRestore;

          return {
            didAcceptTypingAfterRestore,
            didAcceptTypingWhileMinimized,
            isMinimized
          };

          function getEditor(): NonNullable<NonNullable<typeof app.workspace.activeEditor>['editor']> {
            const editor = app.workspace.activeEditor?.editor;
            if (!editor) {
              throw new Error('no active editor');
            }
            return editor;
          }

          function readValue(): string {
            return getEditor().getValue();
          }

          async function settle(): Promise<void> {
            const SETTLE_DELAY_MILLISECONDS = 300;
            await sleep(SETTLE_DELAY_MILLISECONDS);
          }
        }
      });

      // Minimizing actually minimized the modal.
      expect(result.isMinimized).toBe(true);
      // The keyboard is blocked while the modal is minimized (peek-only lock).
      expect(result.didAcceptTypingWhileMinimized).toBe(false);
      // Editing works again once the modal is restored and closed.
      expect(result.didAcceptTypingAfterRestore).toBe(true);
    });

    it('should block opening another modal while minimized and allow it again after restore', async () => {
      const result = await evalInObsidian({
        async fn({ app, obsidianModule }): Promise<ModalOpenBlockedResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const SETTLE_DELAY_MILLISECONDS = 300;

          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          minimizable.minimize();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          // Opening another modal while minimized is blocked, so its container never joins the DOM.
          const blockedModal = new obsidianModule.Modal(app);
          blockedModal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const didOpenWhileMinimized = blockedModal.containerEl.isConnected;
          blockedModal.close();

          // After restore the lock lifts, so opening a modal works again.
          minimizable.restore();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const allowedModal = new obsidianModule.Modal(app);
          allowedModal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const didOpenAfterRestore = allowedModal.containerEl.isConnected;
          allowedModal.close();

          minimizable.modal.close();

          return {
            didOpenAfterRestore,
            didOpenWhileMinimized
          };
        }
      });

      // The re-entrant modal is blocked while the first is minimized (the core of the reported bug).
      expect(result.didOpenWhileMinimized).toBe(false);
      // Once restored, opening modals works normally again.
      expect(result.didOpenAfterRestore).toBe(true);
    });

    it('should block opening the settings popout while minimized so no empty settings window appears', async () => {
      const result = await evalInObsidian({
        async fn({ app, obsidianModule }): Promise<SettingsPopoutBlockedResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const SETTLE_DELAY_MILLISECONDS = 300;

          // Start from a clean state so a settings window a prior suite left open cannot skew the read.
          app.setting.close();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          minimizable.minimize();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          // Opening Settings while minimized must be blocked BEFORE its popout window is created — the
          // Whole point of the fix. Previously the window appeared but rendered empty (bad UX).
          app.setting.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const didOpenSettingsWhileMinimized = isSettingsOpen();
          app.setting.close();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          // After restore the lock lifts, so Settings opens its popout window normally again.
          minimizable.restore();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          app.setting.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);
          const didOpenSettingsAfterRestore = isSettingsOpen();
          app.setting.close();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          minimizable.modal.close();

          return {
            didOpenSettingsAfterRestore,
            didOpenSettingsWhileMinimized
          };

          function isSettingsOpen(): boolean {
            // Obsidian's Settings opens in a separate popout window on desktop; `app.setting.popout` is
            // Set only while that window exists. It is a 1.13 (catalyst) member absent from the public
            // Typings this library targets, so read it reflectively — the peek-lock's win is that it
            // Stays unset while minimized (no window is created).
            // TODO: Simplify to `app.setting.popout` once Obsidian 1.13 is public and
            // `obsidian-public-latest` typings model `AppSetting.popout`.
            return Boolean(Reflect.get(app.setting, 'popout'));
          }
        }
      });

      // Settings never opened its popout window while the modal was minimized (no empty window).
      expect(result.didOpenSettingsWhileMinimized).toBe(false);
      // Once restored, Settings opens normally again.
      expect(result.didOpenSettingsAfterRestore).toBe(true);
    });
  });

  describe('restore', () => {
    it('should restore when the minimized bar body or its title is clicked, not only the restore button', async () => {
      const result = await evalInObsidian({
        async fn({ app, obsidianModule }): Promise<RestoreByClickResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const BAR_SELECTOR = '.minimized-modal-bar';
          const TITLE_SELECTOR = '.minimized-modal-bar .minimized-modal-bar-title';
          const SETTLE_DELAY_MILLISECONDS = 300;

          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          // Clicking the bar's title (a child of the bar) restores via the bar-level click handler.
          minimizable.minimize();
          const titleEl = document.body.querySelector(TITLE_SELECTOR);
          if (!titleEl) {
            throw new Error('minimized bar title not found');
          }
          titleEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const restoredByTitleClick = !minimizable.isMinimized;
          const barGoneAfterTitleClick = document.body.querySelector(BAR_SELECTOR) === null;

          // Clicking the bar body itself (not the restore button) restores too.
          minimizable.minimize();
          const barEl = document.body.querySelector(BAR_SELECTOR);
          if (!barEl) {
            throw new Error('minimized bar not found');
          }
          barEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const restoredByBarClick = !minimizable.isMinimized;
          const barGoneAfterBarClick = document.body.querySelector(BAR_SELECTOR) === null;

          minimizable.modal.close();

          return {
            barGoneAfterBarClick,
            barGoneAfterTitleClick,
            restoredByBarClick,
            restoredByTitleClick
          };
        }
      });

      expect(result.restoredByTitleClick).toBe(true);
      expect(result.barGoneAfterTitleClick).toBe(true);
      expect(result.restoredByBarClick).toBe(true);
      expect(result.barGoneAfterBarClick).toBe(true);
    });
  });

  describe('hover', () => {
    it('should keep the minimized bar opaque on hover so editor content behind it never bleeds through', async () => {
      const result = await evalInObsidian({
        async fn({ app, hoverElement, obsidianModule, unhoverElement }): Promise<HoverOpacityResult> {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }

          const BAR_SELECTOR = '.minimized-modal-bar';
          const SETTLE_DELAY_MILLISECONDS = 300;

          const modal = new obsidianModule.Modal(app);
          modal.setTitle('Working');
          const minimizable = new lib.obsidian.modals['minimizable-modal'].MinimizableModal(modal);
          minimizable.modal.open();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          minimizable.minimize();
          await sleep(SETTLE_DELAY_MILLISECONDS);

          const barEl = document.body.querySelector<HTMLElement>(BAR_SELECTOR);
          if (!barEl) {
            throw new Error('minimized bar not found');
          }

          // A trusted pointer move sets a genuine `:hover`, so real theme `var()` values resolve and
          // Composite as they do for the user. `mouseover` events are untrusted (never set `:hover`),
          // And `jsdom` resolves neither `var()` nor composites — so a real-Obsidian test is used.
          await hoverElement({ element: barEl });
          const backgroundColorWhileHovered = getComputedStyle(barEl).backgroundColor;
          const alphaWhileHovered = alphaOf(backgroundColorWhileHovered);

          await unhoverElement({ element: barEl });
          minimizable.modal.close();

          return {
            alphaWhileHovered,
            backgroundColorWhileHovered
          };

          function alphaOf(color: string): number {
            // CSS Color 4 serialization (`oklch(l c h / a)`, `rgb(r g b / a)`) puts the alpha after the
            // Slash. Obsidian's default theme resolves `--background-modifier-hover` to a `color-mix(...)`
            // Computing to `oklch(0 0 none / 0.067)`, so a naive "count the numbers" parser breaks on the
            // Non-numeric `none` hue. Read the slash-separated alpha token directly instead.
            const slashAlpha = /\/\s*(?<alpha>[\d.]+%?)\s*\)$/.exec(color)?.groups?.['alpha'];
            if (slashAlpha !== undefined) {
              const PERCENT_DIVISOR = 100;
              return slashAlpha.endsWith('%') ? Number(slashAlpha.slice(0, -1)) / PERCENT_DIVISOR : Number(slashAlpha);
            }
            // Legacy comma form `rgba(r, g, b, a)` — the 4th component is the alpha.
            const legacyAlpha = /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*(?<alpha>[\d.]+)\s*\)$/.exec(color)?.groups?.['alpha'];
            if (legacyAlpha !== undefined) {
              return Number(legacyAlpha);
            }
            // `rgb(r, g, b)` / `oklch(l c h)` / hex — no alpha channel serialized means fully opaque.
            return 1;
          }
        }
      });

      // The hovered bar's resolved background-color must be fully opaque (alpha 1). Before the fix, the
      // `:hover` rule replaced the opaque base with translucent `--background-modifier-hover` (alpha
      // ~0.067), letting the editor content behind the floating bar bleed through.
      expect(
        result.alphaWhileHovered,
        `hovered background '${result.backgroundColorWhileHovered}' must be fully opaque`
      ).toBe(1);
    });
  });
});
