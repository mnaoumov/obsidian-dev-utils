/**
 * @file
 *
 * Integration tests for {@link ModalBase} dismissal against a live Obsidian instance.
 *
 * Obsidian's base `Modal` renders an X in the modal header and wires it to `Modal.close()`. Its CSS class
 * changed in Obsidian 1.13.0 — `.modal-close-button` before, `.modal-header-button` since — which made
 * automation that clicks `.modal-close-button` silently select nothing and conclude that the X of an
 * `obsidian-dev-utils` modal was dead (T503).
 *
 * jsdom renders none of that chrome, so only a real Obsidian run can prove both halves of the behavior:
 * the X exists under the current class name, and clicking it settles the promise the helper returned.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface AlertDismissalResult {
  readonly headerButtonCount: number;
  readonly staleCloseButtonCount: number;
}

interface ConfirmDismissalResult {
  readonly headerButtonCount: number;
  readonly isConfirmed: boolean;
  readonly staleCloseButtonCount: number;
}

interface PromptDismissalResult {
  readonly headerButtonCount: number;
  readonly resolvedValue: null | string;
  readonly staleCloseButtonCount: number;
}

describe('modal header close button', () => {
  it('should dismiss an alert modal and resolve its promise', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { alert, waitUntil } }): Promise<AlertDismissalResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        const alertPromise = alert({
          app,
          message: 'Modal header close button test'
        });

        let dismissalResult: AlertDismissalResult;

        try {
          await waitUntil({
            message: 'the alert modal header button renders',
            predicate: () => Boolean(getHeaderButton()),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          dismissalResult = {
            headerButtonCount: document.querySelectorAll('.alert-modal .modal-header-button').length,
            staleCloseButtonCount: document.querySelectorAll('.alert-modal .modal-close-button').length
          };

          getHeaderButton()?.click();

          await waitUntil({
            message: 'the alert modal is removed after its header button is clicked',
            predicate: () => !getContainerEl(),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          getHeaderButton()?.click();
        }

        // The modal is gone, so `onClose` has run and this can only await an already settled promise.
        // A hang here would mean the close path never resolved what the caller is waiting on.
        await alertPromise;
        return dismissalResult;

        function getContainerEl(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.alert-modal');
        }

        function getHeaderButton(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.alert-modal .modal-header-button');
        }
      }
    });

    expect(result.headerButtonCount).toBe(1);

    // The pre-1.13.0 class name, asserted so a rename back is a failure here rather than a silent no-op in
    // Every caller that clicks it.
    expect(result.staleCloseButtonCount).toBe(0);
  });

  it('should dismiss a confirm modal and resolve it as not confirmed', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { confirm, waitUntil } }): Promise<ConfirmDismissalResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        const confirmPromise = confirm({
          app,
          message: 'Modal header close button test'
        });

        let headerButtonCount: number;
        let staleCloseButtonCount: number;

        try {
          await waitUntil({
            message: 'the confirm modal header button renders',
            predicate: () => Boolean(getHeaderButton()),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          headerButtonCount = document.querySelectorAll('.confirm-modal .modal-header-button').length;
          staleCloseButtonCount = document.querySelectorAll('.confirm-modal .modal-close-button').length;

          getHeaderButton()?.click();

          await waitUntil({
            message: 'the confirm modal is removed after its header button is clicked',
            predicate: () => !getContainerEl(),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          getHeaderButton()?.click();
        }

        const isConfirmed = await confirmPromise;

        return {
          headerButtonCount,
          isConfirmed,
          staleCloseButtonCount
        };

        function getContainerEl(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.confirm-modal');
        }

        function getHeaderButton(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.confirm-modal .modal-header-button');
        }
      }
    });

    expect(result.headerButtonCount).toBe(1);
    expect(result.staleCloseButtonCount).toBe(0);
    expect(result.isConfirmed).toBe(false);
  });

  it('should dismiss a prompt modal and resolve it as cancelled', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { prompt, waitUntil } }): Promise<PromptDismissalResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        const promptPromise = prompt({ app });

        let headerButtonCount: number;
        let staleCloseButtonCount: number;

        try {
          await waitUntil({
            message: 'the prompt modal header button renders',
            predicate: () => Boolean(getHeaderButton()),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          headerButtonCount = document.querySelectorAll('.prompt-modal .modal-header-button').length;
          staleCloseButtonCount = document.querySelectorAll('.prompt-modal .modal-close-button').length;

          getHeaderButton()?.click();

          await waitUntil({
            message: 'the prompt modal is removed after its header button is clicked',
            predicate: () => !getContainerEl(),
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          getHeaderButton()?.click();
        }

        const resolvedValue = await promptPromise;

        return {
          headerButtonCount,
          resolvedValue,
          staleCloseButtonCount
        };

        function getContainerEl(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.prompt-modal');
        }

        function getHeaderButton(): HTMLElement | null {
          return document.querySelector<HTMLElement>('.prompt-modal .modal-header-button');
        }
      }
    });

    expect(result.headerButtonCount).toBe(1);
    expect(result.staleCloseButtonCount).toBe(0);
    expect(result.resolvedValue).toBeNull();
  });
});
