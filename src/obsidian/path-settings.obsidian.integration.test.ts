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
 * and the async-error event asserted here is the very event that renders that notice. The test wires up
 * its own {@link AsyncErrorHandlerComponent} so that notice is genuinely rendered rather than merely
 * implied — the pooled Obsidian instance carries no `PluginBase` plugin, so nothing else would render it.
 *
 * It also proves the `pathsValidator` message resolves through ODU's real i18n in a live Obsidian, not
 * just through the lazily initialized fallback a unit test sees.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type { Notice } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginNoticeComponentShowNoticeOptions } from './components/plugin-notice-component.ts';
import type { PluginEventMap } from './plugin/plugin-event-source.ts';

interface TypingResult {
  readonly asyncErrors: string[];
  readonly isInboxNoteIgnored: boolean;
  readonly savedExcludePaths: unknown;
  readonly shownNoticeMessages: string[];
  readonly validationMessageForCompletedRegExp: string;
  readonly validationMessageForInvalidRegExp: string;
}

const HARNESS_PLUGIN_ID = 'obsidian-dev-utils-integration-test';
const REPORTED_REG_EXP = String.raw`/^Inbox\/[^\/]*$/`;
const INVALID_REG_EXP = String.raw`/^Inbox\/`;
// Distinctive on purpose: the notice component keys its permanent-notice slot by the plugin name.
// A name no other file uses keeps this test's slot clear of every neighbor sharing the pooled instance.
const NOTICE_PLUGIN_NAME = 'PathSettings integration test';

describe('PathSettings', () => {
  it('should keep a real settings tab working while an un-parseable regex is typed', async () => {
    const result = await evalInObsidian({
      async callback({
        app,
        harnessPluginId,
        invalidRegExp,
        lib: {
          AsyncErrorHandlerComponent,
          AsyncEvents,
          ensureNonNullable,
          errorToString,
          noopAsync,
          PathSettings,
          pathsValidator,
          PluginNoticeComponent,
          PluginSettingsComponentBase,
          PluginSettingsTabBase,
          registerAsyncErrorEventHandler,
          SettingEx,
          waitUntil
        },
        noticePluginName,
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

        /*
         * A notice is transient by design (AGENTS.md L16), so it cannot be counted off the DOM: this file
         * shares its Obsidian instance with every other pooled integration test, and a neighbor's leftover
         * notice expiring mid-run moved the count with nothing here doing anything wrong. Record notices as
         * they arrive instead. The RenameDeleteHandler tests observe the DOM for this because they assert on
         * notices production code raises; here the test owns the component, so intercepting `showNotice` is
         * both exact and immune to neighbors — no other file can push into this array.
         *
         * The component pair also has to exist at all for the assertion to mean anything: the unhandled-error
         * notice is rendered by `AsyncErrorHandlerComponent`, which only `PluginBase` wires up, and the pooled
         * instance's harness plugin extends plain `Plugin`.
         */
        class RecordingPluginNoticeComponent extends PluginNoticeComponent {
          public readonly shownNoticeMessages: string[] = [];

          public override showNotice(message: DocumentFragment | string, options?: PluginNoticeComponentShowNoticeOptions): Notice {
            this.shownNoticeMessages.push(typeof message === 'string' ? message : message.textContent);
            return super.showNotice(message, options);
          }
        }

        const noticeComponent = new RecordingPluginNoticeComponent({
          app,
          pluginName: noticePluginName
        });
        noticeComponent.load();
        const asyncErrorHandlerComponent = new AsyncErrorHandlerComponent(noticeComponent);
        asyncErrorHandlerComponent.load();

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
            isInboxNoteIgnored,
            savedExcludePaths: (savedData as null | Record<string, unknown>)?.['excludePaths'],
            shownNoticeMessages: noticeComponent.shownNoticeMessages,
            validationMessageForCompletedRegExp,
            validationMessageForInvalidRegExp: textAreaEl.validationMessage
          };
        } finally {
          registration[Symbol.dispose]();
          // Unloaded here so the global async-error handler this component registers never outlives the test.
          asyncErrorHandlerComponent.unload();
          noticeComponent.unload();
          tab.containerEl.remove();
          settingsComponent.unload();
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
      },
      input: {
        harnessPluginId: HARNESS_PLUGIN_ID,
        invalidRegExp: INVALID_REG_EXP,
        noticePluginName: NOTICE_PLUGIN_NAME,
        reportedRegExp: REPORTED_REG_EXP
      }
    });

    expect(result.asyncErrors).toStrictEqual([]);
    expect(result.shownNoticeMessages).toStrictEqual([]);
    expect(result.savedExcludePaths).toStrictEqual([REPORTED_REG_EXP]);
    expect(result.validationMessageForCompletedRegExp).toBe('');
    expect(result.isInboxNoteIgnored).toBe(true);
    expect(result.validationMessageForInvalidRegExp).toBe(`Invalid regular expression: ${INVALID_REG_EXP}`);
  });
});
