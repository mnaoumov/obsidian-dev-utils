/**
 * @file
 *
 * Integration test verifying that a real notice rendered by {@link PluginNoticeComponent} shows the
 * plugin name with the library's accent styling (accent color + bold weight) in a live Obsidian
 * instance, visually distinct from the message body. The unit test only asserts the DOM structure;
 * this test confirms the injected library stylesheet actually applies to the notice.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('PluginNoticeComponent styling', () => {
  it('should render the plugin name with the accent color and bold weight, distinct from the body', async () => {
    const result = await evalInObsidian({
      fn({ lib: { PluginNoticeComponent } }) {
        const component = new PluginNoticeComponent('My Test Plugin');
        const notice = component.showNotice('Body text');

        try {
          const nameEl = activeDocument.querySelector('.obsidian-dev-utils.plugin-notice-name');
          if (!nameEl) {
            throw new Error('plugin name element not found in the rendered notice');
          }

          const nameStyle = activeWindow.getComputedStyle(nameEl);

          // Probe resolving the same theme variables the CSS rule uses (compare computed rgb / weight).
          const probeEl = activeDocument.body.createSpan();
          probeEl.setCssStyles({ color: 'var(--text-accent)', fontWeight: 'var(--font-bold)' });
          const probeStyle = activeWindow.getComputedStyle(probeEl);

          // Plain element inheriting the default text color, to prove the name color is distinct.
          const plainEl = activeDocument.body.createSpan();
          const defaultColor = activeWindow.getComputedStyle(plainEl).color;

          const measurement = {
            accentColor: probeStyle.color,
            boldFontWeight: probeStyle.fontWeight,
            defaultColor,
            hasLibClass: nameEl.classList.contains('obsidian-dev-utils'),
            hasNameClass: nameEl.classList.contains('plugin-notice-name'),
            nameColor: nameStyle.color,
            nameFontWeight: nameStyle.fontWeight,
            text: nameEl.textContent
          };

          probeEl.remove();
          plainEl.remove();
          return measurement;
        } finally {
          notice.hide();
        }
      }
    });

    expect(result.hasLibClass).toBe(true);
    expect(result.hasNameClass).toBe(true);
    expect(result.text).toBe('My Test Plugin');

    // The accent color is actually applied (matches `--text-accent`) and differs from the body text color.
    expect(result.nameColor).toBe(result.accentColor);
    expect(result.nameColor).not.toBe(result.defaultColor);

    // The bold weight is actually applied (matches `--font-bold`) and is not the normal weight.
    expect(result.nameFontWeight).toBe(result.boldFontWeight);
    expect(result.nameFontWeight).not.toBe('400');
  });
});

describe('PluginNoticeComponent.showNoticeAfterDelay', () => {
  it('shows a cancellable notice after the delay whose interactive click does not dismiss it', async () => {
    const result = await evalInObsidian({
      async fn({ lib: { PluginNoticeComponent } }) {
        const DELAY_IN_MILLISECONDS = 50;
        const SETTLE_IN_MILLISECONDS = 250;

        async function wait(milliseconds: number): Promise<void> {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, milliseconds);
          });
        }

        // Scope the lookup to this notice by its text, so a previous test's notice still fading out
        // (same class) is never mistaken for ours.
        function findContentEl(textIncludes: string): Element | null {
          const els = Array.from(activeDocument.querySelectorAll('.obsidian-dev-utils.plugin-notice-content'));
          return els.find((el) => el.textContent.includes(textIncludes)) ?? null;
        }

        const component = new PluginNoticeComponent('My Test Plugin');
        const abortController = new AbortController();
        const handle = component.showNoticeAfterDelay({
          abortController,
          content: 'Working',
          delayInMilliseconds: DELAY_IN_MILLISECONDS
        });

        try {
          const isShownBeforeDelay = findContentEl('Working') !== null;

          await wait(DELAY_IN_MILLISECONDS + SETTLE_IN_MILLISECONDS);
          const contentEl = findContentEl('Working');
          const isShownAfterDelay = contentEl !== null;
          const initialText = contentEl?.textContent ?? '';
          const buttonEl = contentEl?.querySelector('button') ?? null;
          const cancelButtonText = buttonEl?.textContent ?? '';

          // Clicking the Cancel button must abort the controller AND not dismiss the notice (the
          // Interactive-click guard stops the click from reaching the notice's dismiss handler).
          buttonEl?.click();
          await wait(SETTLE_IN_MILLISECONDS);
          const isAbortedAfterCancel = abortController.signal.aborted;
          const isConnectedAfterCancel = buttonEl?.isConnected ?? false;

          // Updating the content of the shown notice.
          handle.setContent('Updated 5/10');
          const updatedText = findContentEl('Updated 5/10')?.textContent ?? '';

          return {
            cancelButtonText,
            initialText,
            isAbortedAfterCancel,
            isConnectedAfterCancel,
            isShownAfterDelay,
            isShownBeforeDelay,
            updatedText
          };
        } finally {
          handle[Symbol.dispose]();
        }
      }
    });

    // Delayed show: nothing before the delay, visible after.
    expect(result.isShownBeforeDelay).toBe(false);
    expect(result.isShownAfterDelay).toBe(true);
    expect(result.initialText).toContain('Working');

    // Abort-wired Cancel button.
    expect(result.cancelButtonText).toBe('Cancel');
    expect(result.isAbortedAfterCancel).toBe(true);
    // The interactive guard kept the notice open when the Cancel button was clicked.
    expect(result.isConnectedAfterCancel).toBe(true);

    // Live content update.
    expect(result.updatedText).toContain('Updated 5/10');
  });
});
