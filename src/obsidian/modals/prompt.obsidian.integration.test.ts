/**
 * @file
 *
 * Integration tests for {@link prompt} against a live Obsidian instance.
 *
 * jsdom's constraint-validation API is a stub with no user interaction, so only a real Obsidian
 * (Electron) run proves the native validation bubble stays hidden until the user types or submits —
 * the greeting reported as advanced-note-composer issue #195.
 *
 * jsdom also never applies the library stylesheet, so the same is true of the red invalid outline the
 * stylesheet paints — reported separately as advanced-note-composer issue #219.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface PromptInvalidOutlineResult {
  readonly boxShadowAfterInput: string;
  readonly boxShadowOnOpen: string;
  readonly errorColor: string;
  readonly value: null | string;
}

interface PromptValidityResult {
  readonly reportCountAfterInput: number;
  readonly reportCountAfterOk: number;
  readonly reportCountOnOpen: number;
  readonly value: null | string;
}

describe('prompt', () => {
  it('should report validity only once the value is edited or submitted', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { prompt, waitUntil } }): Promise<PromptValidityResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        let reportCount = 0;
        const originalReportValidity = HTMLInputElement.prototype.reportValidity;
        HTMLInputElement.prototype.reportValidity = checkValidityAndCountReport;

        const resultPromise = prompt({
          app,
          valueValidator: (value: string) => value === '' ? 'Value cannot be empty' : undefined
        });

        try {
          // The initial validation is async.
          // Waiting for the computed custom error, rather than for the input alone, is what makes a zero
          // Report count meaningful instead of merely proving we looked too early.
          await waitUntil({
            message: 'prompt modal input renders and is computed invalid',
            predicate: () => getInputEl()?.validity.customError === true,
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const reportCountOnOpen = reportCount;

          getInputEl()?.dispatchEvent(new Event('input', { bubbles: true }));
          await waitUntil({
            message: 'validity is reported after the input event',
            predicate: () => reportCount > reportCountOnOpen,
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const reportCountAfterInput = reportCount;

          // `handleOk` is synchronous, so the report lands before `click()` returns.
          getOkButton()?.click();
          const reportCountAfterOk = reportCount;

          getCancelButton()?.click();
          const value = await resultPromise;

          return {
            reportCountAfterInput,
            reportCountAfterOk,
            reportCountOnOpen,
            value
          };
        } finally {
          // eslint-disable-next-line require-atomic-updates -- Restoring a prototype method patched by this very closure; nothing else writes it.
          HTMLInputElement.prototype.reportValidity = originalReportValidity;
          getCancelButton()?.click();
        }

        function checkValidityAndCountReport(this: HTMLInputElement): boolean {
          reportCount++;
          return originalReportValidity.call(this);
        }

        function getButtons(): HTMLButtonElement[] {
          return [...document.querySelectorAll<HTMLButtonElement>('.prompt-modal .modal-content button')];
        }

        function getCancelButton(): HTMLButtonElement | undefined {
          return getButtons()[1];
        }

        function getInputEl(): HTMLInputElement | null {
          return document.querySelector<HTMLInputElement>('.prompt-modal .modal-content input');
        }

        function getOkButton(): HTMLButtonElement | undefined {
          return getButtons()[0];
        }
      }
    });

    expect(result.reportCountOnOpen).toBe(0);
    expect(result.reportCountAfterInput).toBeGreaterThan(0);
    expect(result.reportCountAfterOk).toBeGreaterThan(result.reportCountAfterInput);
    expect(result.value).toBeNull();
  });

  it('should paint the invalid outline only once the value is edited', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { prompt, waitUntil } }): Promise<PromptInvalidOutlineResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        const resultPromise = prompt({
          app,
          valueValidator: (value: string) => value === '' ? 'Value cannot be empty' : undefined
        });

        try {
          // The initial validation is async.
          // Waiting for the computed custom error is what makes an outline-free box shadow meaningful.
          // A wait for the input alone would only prove that we looked too early.
          await waitUntil({
            message: 'prompt modal input renders and is computed invalid',
            predicate: () => getInputEl()?.validity.customError === true,
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          // The box shadow is transitioned, so a single reading can catch an interpolated color.
          // Two equal consecutive readings mean the transition has settled.
          let previousBoxShadow = '';
          await waitUntil({
            message: 'the input box shadow settles after the modal opens',
            predicate: () => {
              const currentBoxShadow = getBoxShadow();
              const isSettled = currentBoxShadow === previousBoxShadow;
              previousBoxShadow = currentBoxShadow;
              return isSettled;
            },
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const errorColor = getErrorColor();
          const boxShadowOnOpen = getBoxShadow();

          getInputEl()?.dispatchEvent(new Event('input', { bubbles: true }));
          await waitUntil({
            message: 'the invalid outline is painted after the input event',
            predicate: () => getBoxShadow().includes(errorColor),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const boxShadowAfterInput = getBoxShadow();

          getCancelButton()?.click();
          const value = await resultPromise;

          return {
            boxShadowAfterInput,
            boxShadowOnOpen,
            errorColor,
            value
          };
        } finally {
          getCancelButton()?.click();
        }

        function getBoxShadow(): string {
          const inputEl = getInputEl();
          return inputEl ? inputEl.win.getComputedStyle(inputEl).boxShadow : '';
        }

        function getButtons(): HTMLButtonElement[] {
          return [...document.querySelectorAll<HTMLButtonElement>('.prompt-modal .modal-content button')];
        }

        function getCancelButton(): HTMLButtonElement | undefined {
          return getButtons()[1];
        }

        function getErrorColor(): string {
          const inputEl = getInputEl();
          if (!inputEl) {
            return '';
          }

          // The stylesheet paints `var(--text-error)` while a computed box shadow carries a resolved color.
          // A probe element resolves the variable in the same document, in the same serialization.
          const probeEl = inputEl.doc.body.createDiv();
          probeEl.setCssProps({ color: 'var(--text-error)' });
          const errorColor = inputEl.win.getComputedStyle(probeEl).color;
          probeEl.remove();
          return errorColor;
        }

        function getInputEl(): HTMLInputElement | null {
          return document.querySelector<HTMLInputElement>('.prompt-modal .modal-content input');
        }
      }
    });

    expect(result.errorColor).not.toBe('');
    expect(result.boxShadowOnOpen).not.toContain(result.errorColor);
    expect(result.boxShadowAfterInput).toContain(result.errorColor);
    expect(result.value).toBeNull();
  });
});
