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
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const { PluginNoticeComponent } = lib.obsidian.components['plugin-notice-component'];
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
