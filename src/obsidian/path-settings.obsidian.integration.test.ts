/**
 * @file
 *
 * Integration tests for {@link PathSettings} against a live Obsidian instance.
 *
 * These confirm what a `jsdom` unit test cannot: a partially typed regex literal typed into a real
 * `addMultipleText` setting travels the full production chain — Obsidian's `input` event, the tab's
 * `bind` handler, `convertAsyncToSync`, `setProperty`, the `PathSettings` setter, and the debounced
 * `saveToFile` with its `cloneSettings` → `rawRecordToSettings` round trip. That chain is exactly what
 * turned a `SyntaxError` into an "unhandled error" notice and a settings file that stopped being saved,
 * and the async-error event asserted here is the very event that renders that notice.
 *
 * It also proves the `pathsValidator` message resolves through ODU's real i18n in a live Obsidian, not
 * just through the lazily initialized fallback a unit test sees.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginEventMap } from './plugin/plugin-event-source.ts';

import { dispose } from '../disposable.ts';

interface TypingResult {
  readonly asyncErrors: string[];
  readonly initialNoticeCount: number;
  readonly isInboxNoteIgnored: boolean;
  readonly noticeCount: number;
  readonly savedExcludePaths: unknown;
  readonly validationMessageForCompletedRegExp: string;
  readonly validationMessageForInvalidRegExp: string;
}

const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';
const REPORTED_REG_EXP = String.raw`/^Inbox\/[^\/]*$/`;
const INVALID_REG_EXP = String.raw`/^Inbox\/`;

describe('PathSettings', () => {
  it('should keep a real settings tab working while an un-parseable regex is typed', async () => {
    const result = await evalInObsidian({
      args: {
        harnessPluginId: HARNESS_PLUGIN_ID,
        invalidRegExp: INVALID_REG_EXP,
        reportedRegExp: REPORTED_REG_EXP
      },
      async fn({
        app,
        harnessPluginId,
        invalidRegExp,
        lib: { AsyncEvents, ensureNonNullable, errorToString, noopAsync, PathSettings, pathsValidator, PluginSettingsComponentBase, PluginSettingsTabBase, registerAsyncErrorEventHandler, SettingEx, waitUntil },
        reportedRegExp
      }): Promise<TypingResult> {
        const SETTLE_TIMEOUT_IN_MILLISECONDS = 10_000;
        const KEYSTROKE_SETTLE_TIMEOUT_IN_MILLISECONDS = 20;

        class TestPluginSettings {
          public get excludePaths(): string[] {
            return this._pathSettings.excludePaths;
          }

          public set excludePaths(value: string[]) {
            this._pathSettings.excludePaths = value;
          }

          private readonly _pathSettings = new PathSettings();

          public isPathIgnored(path: string): boolean {
            return this._pathSettings.isPathIgnored(path);
          }
        }

        let savedData: unknown = null;

        const settingsComponent = new PluginSettingsComponentBase<TestPluginSettings>({
          dataHandler: {
            loadData: (): Promise<unknown> => Promise.resolve(savedData),
            saveData: (data: unknown): Promise<void> => {
              savedData = data;
              return noopAsync();
            }
          },
          pluginEventSource: new AsyncEvents<PluginEventMap>(),
          pluginSettingsClass: TestPluginSettings
        });
        settingsComponent.registerValidator('excludePaths', pathsValidator);
        settingsComponent.load();
        await settingsComponent.loadFromFile(true);

        class TestPluginSettingsTab extends PluginSettingsTabBase<TestPluginSettings> {
          public override display(): void {
            this.containerEl.empty();
            new SettingEx(this.containerEl)
              .setName('Exclude paths')
              .addMultipleText((multipleText) => {
                this.bind({
                  propertyName: 'excludePaths',
                  valueComponent: multipleText
                });
              });
          }
        }

        const tab = new TestPluginSettingsTab({
          plugin: ensureNonNullable(app.plugins.getPlugin(harnessPluginId), 'The integration test harness plugin is not loaded'),
          pluginSettingsComponent: settingsComponent
        });
        activeDocument.body.append(tab.containerEl);
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- The override clears the upstream deprecation, but the rule walks the inheritance chain (AGENTS.md L1).
        tab.display();

        const asyncErrors: string[] = [];
        const registration = registerAsyncErrorEventHandler((asyncError) => {
          asyncErrors.push(errorToString(asyncError));
        });
        const initialNoticeCount = getNoticeCount();

        try {
          const textAreaEl = ensureNonNullable(tab.containerEl.querySelector<HTMLTextAreaElement>('textarea'), 'The multiple text component is missing');

          for (let length = 1; length <= reportedRegExp.length; length++) {
            await type(textAreaEl, reportedRegExp.slice(0, length));
          }

          await waitUntilOrGiveUp(() => savedData !== null);

          const validationMessageForCompletedRegExp = textAreaEl.validationMessage;
          const isInboxNoteIgnored = settingsComponent.settings.isPathIgnored('Inbox/note.md');

          await type(textAreaEl, invalidRegExp);
          await waitUntilOrGiveUp(() => textAreaEl.validationMessage !== '');

          return {
            asyncErrors,
            initialNoticeCount,
            isInboxNoteIgnored,
            noticeCount: getNoticeCount(),
            savedExcludePaths: (savedData as null | Record<string, unknown>)?.['excludePaths'],
            validationMessageForCompletedRegExp,
            validationMessageForInvalidRegExp: textAreaEl.validationMessage
          };
        } finally {
          dispose(registration);
          tab.containerEl.remove();
          settingsComponent.unload();
        }

        function getNoticeCount(): number {
          return activeDocument.body.querySelectorAll('.notice').length;
        }

        async function type(textAreaEl: HTMLTextAreaElement, value: string): Promise<void> {
          textAreaEl.value = value;
          textAreaEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await sleep(KEYSTROKE_SETTLE_TIMEOUT_IN_MILLISECONDS);
        }

        /*
         * Swallows the timeout so that a regression reports EVERY broken expectation at once (no async
         * errors, the value was saved, the message was surfaced) instead of aborting on the first wait.
         * Before the fix the throw escaped the setter, so the debounced save never completed and this
         * would otherwise fail as a bare "test timed out" with nothing pointing at the cause.
         */
        async function waitUntilOrGiveUp(isDone: () => boolean): Promise<void> {
          try {
            await waitUntil({
              message: 'the settings pipeline settles',
              predicate: isDone,
              timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
            });
          } catch {
            // The assertions on the returned result report what actually went wrong.
          }
        }
      }
    });

    expect(result.asyncErrors).toStrictEqual([]);
    expect(result.noticeCount).toBe(result.initialNoticeCount);
    expect(result.savedExcludePaths).toStrictEqual([REPORTED_REG_EXP]);
    expect(result.validationMessageForCompletedRegExp).toBe('');
    expect(result.isInboxNoteIgnored).toBe(true);
    expect(result.validationMessageForInvalidRegExp).toBe(`Invalid regular expression: ${INVALID_REG_EXP}`);
  });
});
