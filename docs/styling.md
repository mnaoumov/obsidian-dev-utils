# Styling

`Obsidian Dev Utils` provides some extensible styles that you can use to style your plugin UI controls.

In order to use those styles in your plugin, the plugin context has to be initialized.

If your plugin class extends `PluginBase` (it should if your project was generated using [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin)), this is handled automatically.

Otherwise, you need to initialize it manually:

```ts
import {
  initPluginContext
} from 'obsidian-dev-utils/obsidian/Plugin/PluginContext';

class MyPlugin extends Plugin {
  public override onload(): void {
    initPluginContext(this.app, this.manifest.id);
    // ...
  }
}
```

Default styles are defined in [main.scss](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/styles/main.scss).

The list of css classes is defined in [CssClass.ts](https://github.com/mnaoumov/obsidian-dev-utils/blob/main/src/CssClass.ts).

You can override those styles in your plugin's `styles.css` file via adding your plugin's id to the selector, e.g. for plugin `foo-bar`:

```css
.foo-bar.obsidian-dev-utils :invalid {
  box-shadow: 0 0 0 2px var(--text-error);
}
```
