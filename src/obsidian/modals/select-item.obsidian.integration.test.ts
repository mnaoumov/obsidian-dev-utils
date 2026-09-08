/**
 * @file
 *
 * Integration tests for {@link selectItem} against a live Obsidian instance.
 *
 * Obsidian builds every `SuggestModal` input with a hardcoded `spellcheck="false"` and never consults
 * `Editor > Spellcheck` there. `obsidian-test-mocks` does not reproduce that, so a real Obsidian run is
 * the only layer that can prove the two things this modal's default rests on: that the box really does
 * arrive unchecked, and that raising the mode overrides Obsidian's own attribute rather than losing to it.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

// `SpellcheckMode` is imported under an alias because the callback pulls the enum VALUE out of
// `lib` under its own name, and that binding would otherwise shadow the type inside the closure.
import type { SpellcheckMode as SpellcheckModeType } from '../obsidian-settings.ts';
import type { SelectItemParams } from './select-item.ts';

interface SelectItemSpellcheckResult {
  readonly attributeAsObsidianBuiltIt: null | string;
  readonly attributeWhenAlwaysOn: null | string;
  readonly attributeWhenFollowingDisabledSetting: null | string;
  readonly attributeWhenFollowingEnabledSetting: null | string;
}

describe('selectItem', () => {
  it('should apply the spellcheck mode to the picker box', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib: { normalizeOptionalProperties, pressKey, selectItem, SpellcheckMode, waitUntil } }): Promise<SelectItemSpellcheckResult> {
        const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;

        const originalSpellcheck = app.vault.getConfig('spellcheck');

        try {
          // Read against an ENABLED setting, so a default that silently followed it would report `true`.
          app.vault.setConfig('spellcheck', true);
          const attributeAsObsidianBuiltIt = await readSpellcheckAttribute();
          const attributeWhenFollowingEnabledSetting = await readSpellcheckAttribute(SpellcheckMode.FollowObsidianSetting);

          app.vault.setConfig('spellcheck', false);
          const attributeWhenFollowingDisabledSetting = await readSpellcheckAttribute(SpellcheckMode.FollowObsidianSetting);
          const attributeWhenAlwaysOn = await readSpellcheckAttribute(SpellcheckMode.AlwaysOn);

          return {
            attributeAsObsidianBuiltIt,
            attributeWhenAlwaysOn,
            attributeWhenFollowingDisabledSetting,
            attributeWhenFollowingEnabledSetting
          };
        } finally {
          app.vault.setConfig('spellcheck', originalSpellcheck);
        }

        function getInputEl(): HTMLInputElement | null {
          return document.querySelector<HTMLInputElement>('.select-item-modal .prompt-input');
        }

        async function readSpellcheckAttribute(spellcheckMode?: SpellcheckModeType): Promise<null | string> {
          const resultPromise = selectItem<string>(normalizeOptionalProperties<SelectItemParams<string>>({
            app,
            items: ['alpha'],
            itemTextFunction: (item: string) => item,
            spellcheckMode
          }));

          try {
            await waitUntil({
              message: 'select-item modal input renders',
              predicate: () => Boolean(getInputEl()),
              timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
            });

            return getInputEl()?.getAttribute('spellcheck') ?? null;
          } finally {
            // Escape rather than detaching the container: the modal has to run its own close path so the
            // Promise resolves.
            await pressKey({ key: 'Escape' });
            await waitUntil({
              message: 'select-item modal closes',
              predicate: () => !getInputEl(),
              timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS
            });
            await resultPromise;
          }
        }
      }
    });

    expect(result.attributeAsObsidianBuiltIt).toBe('false');
    expect(result.attributeWhenFollowingEnabledSetting).toBe('true');
    expect(result.attributeWhenFollowingDisabledSetting).toBe('false');
    expect(result.attributeWhenAlwaysOn).toBe('true');
  });
});
