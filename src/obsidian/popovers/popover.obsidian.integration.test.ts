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
      args: {
        anchorLeftInPixels: ANCHOR_LEFT_IN_PIXELS,
        anchorTopInPixels: ANCHOR_TOP_IN_PIXELS
      },
      async fn({ anchorLeftInPixels, anchorTopInPixels, lib: { createAnchorFromElement, editFieldsInPopover, ensureNonNullable, waitUntil } }): Promise<EditFieldsResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
        const EXPECTED_FIELD_COUNT = 2;

        const anchorElement = activeDocument.body.createDiv({ text: 'anchor' });
        anchorElement.setCssProps({
          height: '20px',
          left: `${String(anchorLeftInPixels)}px`,
          position: 'absolute',
          top: `${String(anchorTopInPixels)}px`,
          width: '80px'
        });

        try {
          const resultPromise = editFieldsInPopover({
            anchor: createAnchorFromElement(anchorElement),
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

          const popoverElement = requirePopoverElement();
          const anchorRect = anchorElement.getBoundingClientRect();
          const popoverRect = popoverElement.getBoundingClientRect();
          /*
           * Everything measured off the popover must be read BEFORE it is confirmed: confirming removes
           * it from the document, and `getComputedStyle` of a detached element reports empty strings.
           */
          const position = activeWindow.getComputedStyle(popoverElement).position;
          const inputEls = getInputEls();
          const inputValues = inputEls.map((inputElement) => inputElement.value);
          // The buttons row is a `Setting` too, so it contributes an empty name element to skip.
          const fieldNames = Array.from(popoverElement.querySelectorAll('.setting-item-name'))
            .map((nameElement) => nameElement.textContent)
            .filter((name) => Boolean(name));

          setInputValue(inputEls[0], 'https://edited.example.com');
          setInputValue(inputEls[1], 'Edited');
          popoverElement.querySelector<HTMLButtonElement>('.ok-button')?.click();

          const resolved = await resultPromise;

          return {
            fieldNames,
            hasMenuClass: popoverElement.classList.contains('menu'),
            inputValues,
            isBelowAnchor: popoverRect.top >= anchorRect.bottom,
            isInsideViewport: popoverRect.left >= 0
              && popoverRect.top >= 0
              && popoverRect.right <= activeWindow.innerWidth
              && popoverRect.bottom <= activeWindow.innerHeight,
            isRemoved: !getPopoverElement(),
            position,
            resolved
          };
        } finally {
          anchorElement.remove();
        }

        function getInputEls(): HTMLInputElement[] {
          return Array.from(getPopoverElement()?.querySelectorAll<HTMLInputElement>('input') ?? []);
        }

        function getPopoverElement(): HTMLElement | null {
          return activeDocument.body.querySelector<HTMLElement>('.obsidian-dev-utils.popover');
        }

        function requirePopoverElement(): HTMLElement {
          return ensureNonNullable(getPopoverElement(), 'The popover is not open');
        }

        function setInputValue(inputElement: HTMLInputElement | undefined, value: string): void {
          const element = ensureNonNullable(inputElement, 'The field is missing');
          element.value = value;
          element.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
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
      async fn({ lib: { createAnchorFromPoint, editFieldsInPopover, waitUntil } }): Promise<DismissResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
        const ANCHOR_X_IN_PIXELS = 40;
        const ANCHOR_Y_IN_PIXELS = 40;

        const resultPromise = editFieldsInPopover({
          anchor: createAnchorFromPoint(ANCHOR_X_IN_PIXELS, ANCHOR_Y_IN_PIXELS, activeDocument),
          fields: [{ defaultValue: 'Example', key: 'alias', name: 'Alias' }]
        });

        await waitUntil({
          message: 'the popover renders',
          predicate: () => Boolean(getPopoverElement()),
          timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
        });

        activeDocument.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        const resolved = await resultPromise;
        return {
          isRemoved: !getPopoverElement(),
          resolved
        };

        function getPopoverElement(): HTMLElement | null {
          return activeDocument.body.querySelector<HTMLElement>('.obsidian-dev-utils.popover');
        }
      }
    });

    expect(result.resolved).toBeNull();
    expect(result.isRemoved).toBe(true);
  });
});
