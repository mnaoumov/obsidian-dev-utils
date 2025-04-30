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

## [PluginTypesBase](https://github.com/mnaoumov/obsidian-dev-utils/tree/main/src/obsidian/Plugin/PluginTypesBase.ts)

It is a type helper to simplify working with generics.

Most of the plugins contain 4 components

- `Plugin` - plugin itself.
- `PluginSettings` - some settings to configure plugin's behavior, usually set via UI.
- `PluginSettingsManager` - manager to control settings loading/saving, migration on newer versions, etc.
- `PluginSettingsTab` - UI tab to modify `PluginSettings`.

To avoid passing all 4 components across the code, you just define

```ts
export interface FooPluginTypes {
  plugin: FooPlugin;
  pluginSettings: FooPluginSettings;
  pluginSettingsManager: FooPluginSettingsManager;
  pluginSettingsTab: FooPluginSettingsTab;
}
```

Corresponding types will be extracted from this wrapper automatically when needed.

## [PluginBase](https://github.com/mnaoumov/obsidian-dev-utils/tree/main/src/obsidian/Plugin/PluginBase.ts)

`PluginBase` is a base class for plugins, that has some additional useful features to standard [Obsidian Plugin class](https://docs.obsidian.md/Reference/TypeScript+API/Plugin).

```ts
export class FooPlugin extends PluginBase<FooPluginTypes> {
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

## [PluginSettingsManagerBase](https://github.com/mnaoumov/obsidian-dev-utils/tree/main/src/obsidian/Plugin/PluginSettingsManagerBase.ts)

```ts
export class FooPluginSettingsManager extends PluginSettingsManagerBase<FooPluginTypes> {
}
```

The most important methods in the execution order:

- `createDefaultSettings()`
- `registerValidators()`
- `onLoadRecord()`
- `onSavingRecord()`

## [PluginSettingsTabBase](https://github.com/mnaoumov/obsidian-dev-utils/tree/main/src/obsidian/Plugin/PluginSettingsTabBase.ts)

```ts
export class FooPluginSettingsTab extends PluginSettingsTabBase<FooPluginTypes> {
}
```

The most important methods in the execution order:

- `display()`
- `bind()`

## Working with plugin settings

Most of the times, it's enough to use `plugin.settings` which is just an alias to `plugin.settingsManager.settingsWrapper.safeSettings`.

For more advanced scenarios, you can use `plugin.settingsManager.settingsWrapper` with the following properties:

- `settings` - values as been set, even if they don't pass validation.
- `safeSettings` - set values, if they pass validation, or default value, otherwise.
- `validationMessages` - contains validation messages for each setting properties that don't pass validation.
