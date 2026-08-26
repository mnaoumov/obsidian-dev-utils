/**
 * @file
 *
 * Integration tests for {@link editFieldsInPopover} against a live Obsidian instance.
 *
 * These confirm what a `jsdom` unit test cannot: the popover really renders with Obsidian's `.menu`
 * chrome and the library's own layout styles, it really lands below its anchor and inside the
 * viewport (`jsdom` reports every box as zero-sized), and the real `TextComponent` values reach the
 * resolved record. The outside-dismissal case is here for the same reason — it hangs on a real
 * `pointerdown` reaching a capture-phase document listener.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface DismissResult {
  readonly isRemoved: boolean;
  readonly resolved: null | Record<string, string>;
}

interface EditFieldsResult {
  readonly fieldNames: (null | string)[];
  readonly hasMenuClass: boolean;
  readonly inputValues: string[];
  readonly isBelowAnchor: boolean;
  readonly isInsideViewport: boolean;
  readonly isRemoved: boolean;
  readonly position: string;
  readonly resolved: null | Record<string, string>;
}

const ANCHOR_LEFT_IN_PIXELS = 120;
const ANCHOR_TOP_IN_PIXELS = 160;

describe('editFieldsInPopover', () => {
  it('should render an anchored popover and resolve the edited values', async () => {
    const result = await evalInObsidian({
      async callback({ anchorLeftInPixels, anchorTopInPixels, lib: { createAnchorFromElement, editFieldsInPopover, ensureNonNullable, waitUntil } }): Promise<EditFieldsResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
        const EXPECTED_FIELD_COUNT = 2;

        const anchorEl = activeDocument.body.createDiv({ text: 'anchor' });
        anchorEl.setCssProps({
          height: '20px',
          left: `${String(anchorLeftInPixels)}px`,
          position: 'absolute',
          top: `${String(anchorTopInPixels)}px`,
          width: '80px'
        });

        try {
          const resultPromise = editFieldsInPopover({
            anchor: createAnchorFromElement(anchorEl),
            fields: [
              { defaultValue: 'https://example.com', key: 'url', name: 'URL' },
              { defaultValue: 'Example', key: 'alias', name: 'Alias' }
            ]
          });

          await waitUntil({
            message: 'the popover renders its fields',
            predicate: () => getInputEls().length >= EXPECTED_FIELD_COUNT,
            timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
          });

          const popoverEl = requirePopoverEl();
          const anchorRect = anchorEl.getBoundingClientRect();
          const popoverRect = popoverEl.getBoundingClientRect();
          /*
           * Everything measured off the popover must be read BEFORE it is confirmed: confirming removes
           * it from the document, and `getComputedStyle` of a detached element reports empty strings.
           */
          const position = activeWindow.getComputedStyle(popoverEl).position;
          const inputEls = getInputEls();
          const inputValues = inputEls.map((inputEl) => inputEl.value);
          // The buttons row is a `Setting` too, so it contributes an empty name element to skip.
          const fieldNames = [...popoverEl.querySelectorAll('.setting-item-name')]
            .map((nameEl) => nameEl.textContent)
            .filter(Boolean);

          setInputValue(inputEls[0], 'https://edited.example.com');
          setInputValue(inputEls[1], 'Edited');
          popoverEl.querySelector<HTMLButtonElement>('.ok-button')?.click();

          const resolved = await resultPromise;

          return {
            fieldNames,
            hasMenuClass: popoverEl.classList.contains('menu'),
            inputValues,
            isBelowAnchor: popoverRect.top >= anchorRect.bottom,
            isInsideViewport: popoverRect.left >= 0
              && popoverRect.top >= 0
              && popoverRect.right <= activeWindow.innerWidth
              && popoverRect.bottom <= activeWindow.innerHeight,
            isRemoved: !getPopoverEl(),
            position,
            resolved
          };
        } finally {
          anchorEl.remove();
        }

        function getInputEls(): HTMLInputElement[] {
          return [...getPopoverEl()?.querySelectorAll<HTMLInputElement>('input') ?? []];
        }

        function getPopoverEl(): HTMLElement | null {
          return activeDocument.body.querySelector<HTMLElement>('.obsidian-dev-utils.popover');
        }

        function requirePopoverEl(): HTMLElement {
          return ensureNonNullable(getPopoverEl(), 'The popover is not open');
        }

        function setInputValue(inputEl: HTMLInputElement | undefined, value: string): void {
          const element = ensureNonNullable(inputEl, 'The field is missing');
          element.value = value;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
      },
      input: {
        anchorLeftInPixels: ANCHOR_LEFT_IN_PIXELS,
        anchorTopInPixels: ANCHOR_TOP_IN_PIXELS
      }
    });

    expect(result.fieldNames).toStrictEqual(['URL', 'Alias']);
    expect(result.inputValues).toStrictEqual(['https://example.com', 'Example']);
    expect(result.hasMenuClass).toBe(true);
    expect(result.position).toBe('absolute');
    expect(result.isBelowAnchor).toBe(true);
    expect(result.isInsideViewport).toBe(true);
    expect(result.resolved).toStrictEqual({
      alias: 'Edited',
      url: 'https://edited.example.com'
    });
    expect(result.isRemoved).toBe(true);
  });

  it('should dismiss with no value when a pointer gesture starts outside it', async () => {
    const result = await evalInObsidian({
      async callback({ lib: { clickElement, createAnchorFromPoint, editFieldsInPopover, waitUntil } }): Promise<DismissResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
        const ANCHOR_X_IN_PIXELS = 40;
        const ANCHOR_Y_IN_PIXELS = 40;

        const resultPromise = editFieldsInPopover({
          anchor: createAnchorFromPoint(ANCHOR_X_IN_PIXELS, ANCHOR_Y_IN_PIXELS, activeDocument),
          fields: [{ defaultValue: 'Example', key: 'alias', name: 'Alias' }]
        });

        await waitUntil({
          message: 'the popover renders',
          predicate: () => Boolean(getPopoverEl()),
          timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
        });

        /*
         * A trusted gesture lands on whatever is really under the pointer, so it is aimed at a scratch
         * overlay well clear of the popover rather than at whichever piece of Obsidian's UI happens to
         * sit there. The `pointerdown` still reaches the document-level listener that dismisses the
         * popover, and nothing in the app is clicked.
         */
        const overlayEl = activeDocument.body.createDiv();
        overlayEl.setCssStyles({
          bottom: '0',
          height: '40%',
          position: 'fixed',
          right: '0',
          width: '40%',
          zIndex: '9998'
        });

        try {
          clickElement({ element: overlayEl });

          const resolved = await resultPromise;
          return {
            isRemoved: !getPopoverEl(),
            resolved
          };
        } finally {
          overlayEl.detach();
        }

        function getPopoverEl(): HTMLElement | null {
          return activeDocument.body.querySelector<HTMLElement>('.obsidian-dev-utils.popover');
        }
      }
    });

    expect(result.resolved).toBeNull();
    expect(result.isRemoved).toBe(true);
  });
});
