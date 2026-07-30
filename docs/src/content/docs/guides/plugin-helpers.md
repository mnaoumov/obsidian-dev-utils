---
title: Plugin Helpers
---

`Obsidian Dev Utils` provides some helpers to simplify your own Obsidian plugin.

- [Sample Plugin Extended](https://github.com/mnaoumov/obsidian-sample-plugin-extended) - sample with different technologies included.
- [Obsidian Plugin Yeoman Generator](https://github.com/mnaoumov/generator-obsidian-plugin) - generator to make plugin from scratch.

> [!WARNING]
>
> Most of the functionality in this section is defined in `public/protected` methods, which is very easy to accidentally override incorrectly.
>
> ```ts
> class Foo extends Bar {
>   public override baz(): void {
>     super.baz(); // you should always add this call unless you have a very good reason not to.
>   }
>
>   public override async qux(): Promise<void> {
>     await super.qux(); // you should always add this call unless you have a very good reason not to.
>   }
> }
> ```
>
> If you omit `super` calls, you might introduce some difficult to catch bugs.
>
> Better add `super` calls every time and remove them only when you are sure it is not needed, or the compiler does not let you (e.g., for abstract methods).

The links below contains the full documentation. Here in the docs we mention only the most important ones.

## [PluginBase](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/obsidian/plugin/plugin.ts)

`PluginBase` is a base class for plugins, that has some additional useful features to standard [Obsidian Plugin class](https://docs.obsidian.md/Reference/TypeScript+API/Plugin).

```ts
export class FooPlugin extends PluginBase {
}
```

The most important methods in the execution order:

- `onload()` - usually you don't need to override it.
- `onloadImpl()`
- `onLoadSettings()`
- `onLayoutReady()`
- `onSaveSettings()`
- `onExternalSettingsChange()` - usually you don't need to override it.
- `onunload()` - usually you don't need to override it.

## [PluginNoticeComponent](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/obsidian/components/plugin-notice-component.ts)

`plugin.pluginNoticeComponent` shows notices prefixed with the plugin name and tied to the plugin lifecycle. Prefer it over constructing an Obsidian `Notice` directly.

```ts
plugin.pluginNoticeComponent.showNotice('Something happened');
```

`showNotice(message, options?)` accepts these options:

- `isPermanent` (default `false`) — the notice stays until it is replaced, the plugin reloads, or the user dismisses it. There is at most one permanent notice per plugin.
- `isReusable` (default `true`) — the notice occupies the single per-plugin reusable slot, so the next reusable notice hides it. Pass `false` for a standalone notice that no later notice hides (multiple standalone notices coexist); standalone notices are still hidden together on unload.
- `requiresCloseConfirmation` (default `false`) — a hard-to-close notice: it never dismisses on a stray click and instead shows a close (X) button whose click opens a confirmation modal, dismissing the notice only if confirmed. It is shown with an infinite duration and is standalone (implies `isReusable: false`).
- `onHide` — a callback invoked the first time the notice is hidden, whether by the user closing it, by a later reusable notice replacing it, by its duration elapsing, or on unload.

The implication rules are enforced — a contradictory combination throws:

- A permanent notice must be reusable, so `isPermanent: true` together with `isReusable: false` throws.
- A hard-to-close notice is standalone, so `requiresCloseConfirmation: true` together with `isReusable: true` throws.

## [PluginSettingsComponentBase](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/obsidian/components/plugin-settings-component.ts)

```ts
export class FooPluginSettingsComponent extends PluginSettingsComponentBase<FooPluginSettings> {
}
```

The most important methods in the execution order:

- `createDefaultSettings()`
- `registerValidators()`
- `onLoadRecord()`
- `onSavingRecord()`

## [PluginSettingsTabBase](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/obsidian/plugin/plugin-settings-tab.ts)

```ts
export class FooPluginSettingsTab extends PluginSettingsTabBase<FooPluginSettings> {
}
```

Obsidian 1.13 renders a settings tab from the definitions it returns, so a tab describes its rows instead of
building them into a container. Override `getSettingDefinitionItems()` and build each row with `settingEx()`,
grouping them with `settingGroupEx()`:

```ts
export class FooPluginSettingsTab extends PluginSettingsTabBase<FooPluginSettings> {
  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingGroupEx({
        heading: 'Invalid characters',
        items: [
          this.settingEx({
            desc: 'How to process invalid characters in the new title.',
            name: 'Invalid characters action',
            render: (setting) => {
              setting.addDropdown((dropdown) => {
                dropdown.addOptions({ Remove: 'Remove', Replace: 'Replace' });
                this.bind({
                  onChanged: () => {
                    this.refreshDomState();
                  },
                  propertyName: 'invalidCharacterAction',
                  valueComponent: dropdown
                });
              });
            }
          }),
          this.settingEx({
            disabled: () => this.pluginSettingsComponent.settings.invalidCharacterAction !== 'Replace',
            name: 'Replacement character',
            render: (setting) => {
              setting.addText((text) => {
                this.bind({ propertyName: 'replacementCharacter', valueComponent: text });
              });
            }
          })
        ]
      })
    ];
  }
}
```

Notes:

- The `setting` a `render` callback receives is a full `SettingEx`, so every custom component
  adder (`addNumber()`, `addMultipleText()`, `addCodeHighlighter()`, …) and `bind()` work exactly as they do
  in an imperative tab.
- `getSettingDefinitionItems()` **must be a pure builder**. Obsidian calls it when the tab is registered — at
  plugin load, long before the tab is opened — to index the settings for search. Put anything with a side
  effect inside a `render` callback, which runs only when the row is actually rendered.
- `disabled` and `visible` accept a function, re-evaluated on every render and on every `refreshDomState()`.
  Prefer `refreshDomState()` when only those predicates change: it toggles the rendered DOM in place. Use
  `refresh()` only when the structure changes, i.e. rows are added or removed.
- Native `control` definitions are supported too — `getControlValue()` / `setControlValue()` are wired to the
  settings component — but `render` + `bind()` is the richer path: it carries validation messages, the
  reset-when-empty behavior, placeholders for default values, and the value converters.
- A tab that has not migrated keeps working: leave `getSettingDefinitionItems()` alone and override
  `displayLegacy()`, which Obsidian falls back to when the definitions are empty.

The most important methods in the execution order:

- `getSettingDefinitionItems()` (or `displayLegacy()` for the imperative fallback)
- `settingGroupEx()` / `settingEx()`
- `bind()`

## Working with plugin settings

Most of the times, it's enough to use `plugin.settings` which is just an alias to `plugin.settingsComponent.settingsState.effectiveValues`.

For more advanced scenarios, you can use `plugin.settingsComponent.settingsState` with the following properties:

- `inputValues` - values as been set, even if they don't pass validation.
- `effectiveValues` - set values, if they pass validation, or default value, otherwise.
- `validationMessages` - contains validation messages for each setting properties that don't pass validation.
