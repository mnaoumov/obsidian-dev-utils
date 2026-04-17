# Plugin Helpers

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

## [PluginBase](../src/obsidian/plugin/plugin.ts)

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
- `onunloadImpl()`

## [PluginSettingsComponentBase](../src/obsidian/plugin/components/plugin-settings-component.ts)

```ts
export class FooPluginSettingsComponent extends PluginSettingsComponentBase<FooPluginSettings> {
}
```

The most important methods in the execution order:

- `createDefaultSettings()`
- `registerValidators()`
- `onLoadRecord()`
- `onSavingRecord()`

## [PluginSettingsTabBase](../src/obsidian/plugin/plugin-settings-tab.ts)

```ts
export class FooPluginSettingsTab extends PluginSettingsTabBase<FooPluginSettings> {
}
```

The most important methods in the execution order:

- `display()`
- `bind()`

## Working with plugin settings

Most of the times, it's enough to use `plugin.settings` which is just an alias to `plugin.settingsComponent.settingsState.effectiveValues`.

For more advanced scenarios, you can use `plugin.settingsComponent.settingsState` with the following properties:

- `inputValues` - values as been set, even if they don't pass validation.
- `effectiveValues` - set values, if they pass validation, or default value, otherwise.
- `validationMessages` - contains validation messages for each setting properties that don't pass validation.
