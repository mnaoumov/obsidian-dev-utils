/**
 * @file
 *
 * Integration tests for the trusted CLICK helpers, against a live Obsidian instance.
 *
 * The unit tests assert the `sendInputEvent` payloads; only a real renderer can prove the point these
 * helpers exist for — that Chromium synthesizes a DOM event carrying `isTrusted === true`, which
 * `element.dispatchEvent(new MouseEvent(...))` never does and which Obsidian's own listeners gate on.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

/**
 * Holds the observed event across the listener callback, so the closure can report it back.
 */
interface ObservedEventCapture {
  value: null | TrustedClickResult;
}

/**
 * What a trusted click reports back: the DOM event it produced, and whether the renderer trusted it.
 */
interface TrustedClickResult {
  readonly isTrusted: boolean;
  readonly type: string;
}

describe('trusted click helpers', () => {
  it('should make clickElement produce a click the renderer trusts', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      async callback({ app, lib: { clickElement, waitUntil } }) {
        const OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS = 5000;

        const target = app.workspace.containerEl.createDiv();
        target.setCssStyles({
          height: '40px',
          left: '10px',
          position: 'fixed',
          top: '10px',
          width: '80px',
          zIndex: '9999'
        });

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('click', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
        });

        try {
          clickElement({ element: target });
          await waitUntil({
            message: 'a trusted click to reach the target element',
            predicate: () => capture.value !== null,
            timeoutInMilliseconds: OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          target.detach();
        }

        if (!capture.value) {
          throw new Error('No click event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: true, type: 'click' });
  });

  it('should make a right clickMouse produce a contextmenu the renderer trusts', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      async callback({ app, lib: { clickMouse, waitUntil } }) {
        const OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS = 5000;
        const TARGET_X = 40;
        const TARGET_Y = 40;

        const target = app.workspace.containerEl.createDiv();
        target.setCssStyles({
          height: '80px',
          left: '0',
          position: 'fixed',
          top: '0',
          width: '80px',
          zIndex: '9999'
        });

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('contextmenu', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
          // A real menu would otherwise open and leak into the next test.
          event.preventDefault();
        });

        try {
          clickMouse({ button: 'right', x: TARGET_X, y: TARGET_Y });
          await waitUntil({
            message: 'a trusted right click to reach the target element',
            predicate: () => capture.value !== null,
            timeoutInMilliseconds: OBSERVED_EVENT_TIMEOUT_IN_MILLISECONDS
          });
        } finally {
          target.detach();
          // `querySelectorAll` returns a static list, so detaching while iterating is safe.
          for (const menuEl of activeDocument.querySelectorAll('.menu')) {
            menuEl.detach();
          }
        }

        if (!capture.value) {
          throw new Error('No contextmenu event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: true, type: 'contextmenu' });
  });

  it('should leave a dispatched MouseEvent untrusted, which is why these helpers exist', async () => {
    const result = await evalInObsidian<Record<string, never>, TrustedClickResult>({
      callback({ app }) {
        const target = app.workspace.containerEl.createDiv();

        const capture: ObservedEventCapture = { value: null };
        target.addEventListener('click', (event: MouseEvent) => {
          capture.value = { isTrusted: event.isTrusted, type: event.type };
        });

        try {
          // The one deliberate untrusted dispatch in the codebase: it is the control case this whole
          // Suite is contrasted against, so it must never be converted to a trusted helper.
          target.dispatchEvent(new MouseEvent('click'));
        } finally {
          target.detach();
        }

        if (!capture.value) {
          throw new Error('No click event was observed.');
        }

        return capture.value;
      }
    });

    expect(result).toEqual({ isTrusted: false, type: 'click' });
  });
});
