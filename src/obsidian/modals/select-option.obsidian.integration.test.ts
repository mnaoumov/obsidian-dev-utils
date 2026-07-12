/**
 * @file
 *
 * Integration tests for {@link selectOption} against a live Obsidian instance.
 *
 * These confirm the real modal renders one button per option (with the correct call-to-action
 * styling) and that clicking a button resolves the promise with that option's value — the behavior
 * the unit tests assert against `obsidian-test-mocks` components.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface SelectOptionResult {
  readonly chosen: null | string;
  readonly ctaLabels: (null | string)[];
  readonly labels: (null | string)[];
}

describe('selectOption', () => {
  it('should render one button per option and resolve the chosen value', async () => {
    const result = await evalInObsidian({
      async fn({ app, lib: { selectOption, waitUntil } }): Promise<SelectOptionResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30000;
        const EXPECTED_OPTION_COUNT = 3;

        const resultPromise = selectOption<string>({
          app,
          message: 'Pick a version',
          options: [
            { isCta: true, text: 'Latest (v2)', value: 'latest' },
            { text: 'Current (v1)', value: 'current' },
            { text: 'Cancel', value: 'cancel' }
          ],
          title: 'Demo vault'
        });

        await waitUntil({
          message: 'select-option modal buttons render',
          predicate: () => getButtons().length >= EXPECTED_OPTION_COUNT,
          timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
        });

        const buttons = getButtons();
        const labels = buttons.map((button) => button.textContent);
        const ctaLabels = buttons.filter((button) => button.classList.contains('mod-cta')).map((button) => button.textContent);

        const cta = buttons.find((button) => button.classList.contains('mod-cta'));
        cta?.click();

        const chosen = await resultPromise;
        return {
          chosen,
          ctaLabels,
          labels
        };

        function getButtons(): HTMLButtonElement[] {
          return Array.from(document.querySelectorAll<HTMLButtonElement>('.select-option-modal .modal-content button'));
        }
      }
    });

    expect(result.labels).toStrictEqual(['Latest (v2)', 'Current (v1)', 'Cancel']);
    expect(result.ctaLabels).toStrictEqual(['Latest (v2)']);
    expect(result.chosen).toBe('latest');
  });
});
