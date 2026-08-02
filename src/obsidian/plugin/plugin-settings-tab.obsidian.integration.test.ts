/**
 * @file
 *
 * Integration tests for {@link PluginSettingsTabBase}'s declarative rendering against a live Obsidian.
 *
 * The unit tests assert the definitions the tab produces; only a real Obsidian can confirm that it renders
 * them the way the migration assumes. Each test here reproduces one of the migration patterns the downstream
 * plugin settings tabs actually use:
 *
 * - a dependent `disabled` predicate re-evaluated by `refreshDomState()` — the dominant pattern, and the one
 *   that relies on Obsidian honouring `disabled` on a `render` row, which its own typings do not declare;
 * - rows added and removed across `refresh()`, the case that genuinely needs a full re-render;
 * - `settingGroupEx` headings plus a row whose `Setting` is adopted into a {@link SettingEx}, so the custom
 *   ODU components and {@link PluginSettingsTabBase.bind} keep working inside a declarative row;
 * - the legacy fallback, so a tab that has not migrated keeps rendering imperatively.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import type { SettingDefinitionItem } from 'obsidian';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { PluginSettingsComponentBase } from '../components/plugin-settings-component.ts';

interface AddRemoveRowsResult {
  readonly namesAfterAdd: string[];
  readonly namesAfterRemove: string[];
  readonly namesInitially: string[];
}

interface DependentDisabledResult {
  readonly isComponentDisabledAfter: boolean;
  readonly isComponentDisabledBefore: boolean;
  readonly isRowDisabledAfter: boolean;
  readonly isRowDisabledBefore: boolean;
  readonly isSameRowElement: boolean;
}

interface DisabledProbe {
  disabled: boolean;
}

interface GroupResult {
  readonly boundInputValue: null | string;
  readonly headings: string[];
  readonly isSettingEx: boolean;
  readonly rowNames: string[];
}

interface LegacyFallbackResult {
  readonly hasLegacyContent: boolean;
  readonly settingItemsLength: number;
}

describe('PluginSettingsTabBase declarative rendering', () => {
  it('should re-evaluate a dependent disabled predicate on refreshDomState without re-rendering the row', async () => {
    const result = await evalInObsidian({
      async fn({ app, lib }): Promise<DependentDisabledResult> {
        const {
          castTo,
          noopAsync,
          PluginSettingsTabBase,
          strictProxy
        } = lib;

        interface AsyncEventSourceStub {
          offref(): void;
        }

        interface EventReferenceStub {
          asyncEventSource: AsyncEventSourceStub;
        }

        interface ProbeSettings {
          enabled: boolean;
        }

        const plugin = Object.values(app.plugins.plugins)[0];
        if (!plugin) {
          throw new Error('no plugin available to host the settings tab');
        }

        const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<ProbeSettings>>({
          defaultSettings: { enabled: false },
          on: castTo<PluginSettingsComponentBase<ProbeSettings>['on']>((): EventReferenceStub => ({ asyncEventSource: { offref: () => undefined } })),
          saveToFile: () => noopAsync(),
          settingsState: {
            effectiveValues: { enabled: false },
            inputValues: { enabled: false },
            validationMessages: { enabled: '' }
          }
        });

        let isDependentDisabled = false;
        // Assigned only inside the `render` closure, so the annotation has to be widened at the initializer
        // Or control-flow analysis narrows every read to `never`.
        let dependentComponent = null as DisabledProbe | null;

        class DependentTab extends PluginSettingsTabBase<ProbeSettings> {
          public override getSettingDefinitionItems(): SettingDefinitionItem[] {
            return [
              this.settingEx({
                name: 'Controller',
                render: (setting) => {
                  setting.addToggle((toggle) => {
                    toggle.setValue(false);
                  });
                }
              }),
              this.settingEx({
                disabled: () => isDependentDisabled,
                name: 'Dependent',
                render: (setting) => {
                  setting.addText((text) => {
                    text.setValue('x');
                  });
                  dependentComponent = castTo<DisabledProbe>(setting.components[0]);
                }
              })
            ];
          }
        }

        const tab = new DependentTab({ plugin, pluginSettingsComponent });
        app.setting.open();
        app.setting.addSettingTab(tab);
        app.setting.openTab(tab);
        await settle();

        const rowElementBefore = findRowElement();
        const isRowDisabledBefore = rowElementBefore.hasClass('is-disabled');
        const isComponentDisabledBefore = dependentComponent?.disabled ?? false;

        // The pattern the plugins use: flip the state a dependent row's predicate reads, then ask Obsidian to
        // Re-evaluate the predicates in place.
        isDependentDisabled = true;
        tab.refreshDomState();
        await settle();

        const rowElementAfter = findRowElement();
        const result2: DependentDisabledResult = {
          isComponentDisabledAfter: dependentComponent?.disabled ?? false,
          isComponentDisabledBefore,
          isRowDisabledAfter: rowElementAfter.hasClass('is-disabled'),
          isRowDisabledBefore,
          isSameRowElement: rowElementBefore === rowElementAfter
        };

        app.setting.close();
        app.setting.removeSettingTab(tab);

        return result2;

        function findRowElement(): HTMLElement {
          const rowElement = [...tab.containerEl.querySelectorAll<HTMLElement>('.setting-item')]
            .find((element) => element.querySelector('.setting-item-name')?.textContent === 'Dependent');
          if (!rowElement) {
            throw new Error('the dependent row was not rendered');
          }
          return rowElement;
        }

        async function settle(): Promise<void> {
          const SETTLE_DELAY_IN_MILLISECONDS = 300;
          await sleep(SETTLE_DELAY_IN_MILLISECONDS);
        }
      }
    });

    expect(result.isRowDisabledBefore).toBe(false);
    expect(result.isComponentDisabledBefore).toBe(false);
    expect(result.isRowDisabledAfter).toBe(true);
    // `Setting.setDisabled` propagates to every component registered on the row, so a single row-level
    // Predicate covers the component-level `setDisabled` the plugins do today.
    expect(result.isComponentDisabledAfter).toBe(true);
    // `refreshDomState` toggles the rendered DOM in place — the row is not rebuilt.
    expect(result.isSameRowElement).toBe(true);
  });

  it('should add and remove rows on refresh', async () => {
    const result = await evalInObsidian({
      async fn({ app, lib }): Promise<AddRemoveRowsResult> {
        const {
          castTo,
          noopAsync,
          PluginSettingsTabBase,
          strictProxy
        } = lib;

        interface AsyncEventSourceStub {
          offref(): void;
        }

        interface EventReferenceStub {
          asyncEventSource: AsyncEventSourceStub;
        }

        interface ProbeSettings {
          enabled: boolean;
        }

        const plugin = Object.values(app.plugins.plugins)[0];
        if (!plugin) {
          throw new Error('no plugin available to host the settings tab');
        }

        const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<ProbeSettings>>({
          defaultSettings: { enabled: false },
          on: castTo<PluginSettingsComponentBase<ProbeSettings>['on']>((): EventReferenceStub => ({ asyncEventSource: { offref: () => undefined } })),
          saveToFile: () => noopAsync(),
          settingsState: {
            effectiveValues: { enabled: false },
            inputValues: { enabled: false },
            validationMessages: { enabled: '' }
          }
        });

        let hasExtraRow = false;

        class StructuralTab extends PluginSettingsTabBase<ProbeSettings> {
          public override getSettingDefinitionItems(): SettingDefinitionItem[] {
            const items: SettingDefinitionItem[] = [
              this.settingEx({
                name: 'Always',
                render: (setting) => {
                  setting.addToggle((toggle) => {
                    toggle.setValue(true);
                  });
                }
              })
            ];

            if (hasExtraRow) {
              items.push(this.settingEx({
                name: 'Extra',
                render: (setting) => {
                  setting.addText((text) => {
                    text.setValue('extra');
                  });
                }
              }));
            }

            return items;
          }
        }

        const tab = new StructuralTab({ plugin, pluginSettingsComponent });
        app.setting.open();
        app.setting.addSettingTab(tab);
        app.setting.openTab(tab);
        await settle();

        const namesInitially = readRowNames();

        hasExtraRow = true;
        tab.refresh();
        await settle();
        const namesAfterAdd = readRowNames();

        hasExtraRow = false;
        tab.refresh();
        await settle();
        const namesAfterRemove = readRowNames();

        app.setting.close();
        app.setting.removeSettingTab(tab);

        return {
          namesAfterAdd,
          namesAfterRemove,
          namesInitially
        };

        function readRowNames(): string[] {
          return [...tab.containerEl.querySelectorAll('.setting-item-name')].map((element) => element.textContent);
        }

        async function settle(): Promise<void> {
          const SETTLE_DELAY_IN_MILLISECONDS = 300;
          await sleep(SETTLE_DELAY_IN_MILLISECONDS);
        }
      }
    });

    expect(result.namesInitially).toEqual(['Always']);
    expect(result.namesAfterAdd).toEqual(['Always', 'Extra']);
    expect(result.namesAfterRemove).toEqual(['Always']);
  });

  it('should render settingGroupEx groups and adopt the row into a SettingEx', async () => {
    const result = await evalInObsidian({
      async fn({ app, lib }): Promise<GroupResult> {
        const {
          castTo,
          noopAsync,
          PluginSettingsTabBase,
          SettingEx,
          strictProxy
        } = lib;

        interface AsyncEventSourceStub {
          offref(): void;
        }

        interface EventReferenceStub {
          asyncEventSource: AsyncEventSourceStub;
        }

        interface ProbeSettings {
          count: number;
        }

        const PROBE_COUNT = 42;

        const plugin = Object.values(app.plugins.plugins)[0];
        if (!plugin) {
          throw new Error('no plugin available to host the settings tab');
        }

        const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<ProbeSettings>>({
          defaultSettings: { count: 0 },
          on: castTo<PluginSettingsComponentBase<ProbeSettings>['on']>((): EventReferenceStub => ({ asyncEventSource: { offref: () => undefined } })),
          saveToFile: () => noopAsync(),
          setProperty: castTo<PluginSettingsComponentBase<ProbeSettings>['setProperty']>(() => Promise.resolve('')),
          settingsState: {
            effectiveValues: { count: PROBE_COUNT },
            inputValues: { count: PROBE_COUNT },
            validationMessages: { count: '' }
          }
        });

        let isSettingEx = false;

        class GroupedTab extends PluginSettingsTabBase<ProbeSettings> {
          public override getSettingDefinitionItems(): SettingDefinitionItem[] {
            return [
              this.settingGroupEx({
                heading: 'Numbers',
                items: [
                  this.settingEx({
                    name: 'Count',
                    render: (setting) => {
                      isSettingEx = setting instanceof SettingEx;
                      // `addNumber` exists only on SettingEx — this is the adoption under test.
                      setting.addNumber((numberComponent) => {
                        this.bind({ propertyName: 'count', valueComponent: numberComponent });
                      });
                    }
                  })
                ]
              })
            ];
          }
        }

        const tab = new GroupedTab({ plugin, pluginSettingsComponent });
        app.setting.open();
        app.setting.addSettingTab(tab);
        app.setting.openTab(tab);
        await settle();

        const result2: GroupResult = {
          boundInputValue: tab.containerEl.querySelector<HTMLInputElement>('input[type="number"]')?.value ?? null,
          headings: [...tab.containerEl.querySelectorAll('.setting-item-heading .setting-item-name')].map((element) => element.textContent),
          isSettingEx,
          rowNames: [...tab.containerEl.querySelectorAll('.setting-item:not(.setting-item-heading) .setting-item-name')].map((element) => element.textContent)
        };

        app.setting.close();
        app.setting.removeSettingTab(tab);

        return result2;

        async function settle(): Promise<void> {
          const SETTLE_DELAY_IN_MILLISECONDS = 300;
          await sleep(SETTLE_DELAY_IN_MILLISECONDS);
        }
      }
    });

    expect(result.isSettingEx).toBe(true);
    expect(result.headings).toContain('Numbers');
    expect(result.rowNames).toContain('Count');
    expect(result.boundInputValue).toBe('42');
  });

  it('should fall back to displayLegacy when the tab provides no definitions', async () => {
    const result = await evalInObsidian({
      async fn({ app, lib }): Promise<LegacyFallbackResult> {
        const {
          castTo,
          noopAsync,
          PluginSettingsTabBase,
          strictProxy
        } = lib;

        const LEGACY_CLASS = 'probe-legacy-content';

        interface AsyncEventSourceStub {
          offref(): void;
        }

        interface EventReferenceStub {
          asyncEventSource: AsyncEventSourceStub;
        }

        interface ProbeSettings {
          enabled: boolean;
        }

        const plugin = Object.values(app.plugins.plugins)[0];
        if (!plugin) {
          throw new Error('no plugin available to host the settings tab');
        }

        const pluginSettingsComponent = strictProxy<PluginSettingsComponentBase<ProbeSettings>>({
          defaultSettings: { enabled: false },
          on: castTo<PluginSettingsComponentBase<ProbeSettings>['on']>((): EventReferenceStub => ({ asyncEventSource: { offref: () => undefined } })),
          saveToFile: () => noopAsync(),
          settingsState: {
            effectiveValues: { enabled: false },
            inputValues: { enabled: false },
            validationMessages: { enabled: '' }
          }
        });

        class LegacyTab extends PluginSettingsTabBase<ProbeSettings> {
          public override displayLegacy(): void {
            super.displayLegacy();
            this.containerEl.createDiv({
              cls: LEGACY_CLASS,
              text: 'legacy-content'
            });
          }
        }

        const tab = new LegacyTab({ plugin, pluginSettingsComponent });
        app.setting.open();
        app.setting.addSettingTab(tab);
        app.setting.openTab(tab);
        await settle();

        const result2: LegacyFallbackResult = {
          hasLegacyContent: tab.containerEl.querySelector(`.${LEGACY_CLASS}`) !== null,
          settingItemsLength: tab.settingItems.length
        };

        app.setting.close();
        app.setting.removeSettingTab(tab);

        return result2;

        async function settle(): Promise<void> {
          const SETTLE_DELAY_IN_MILLISECONDS = 300;
          await sleep(SETTLE_DELAY_IN_MILLISECONDS);
        }
      }
    });

    expect(result.hasLegacyContent).toBe(true);
    expect(result.settingItemsLength).toBe(0);
  });
});
