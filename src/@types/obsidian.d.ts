/**
 * @file
 *
 * Augments the Obsidian typings with the `disabled` predicate that `SettingDefinitionRender` honours at
 * runtime but does not declare.
 *
 * Obsidian's `obsidian.d.ts` puts `disabled` on `SettingDefinitionControl` and `SettingDefinitionAction`
 * only. The 1.13.4 renderer, however, reads it off every definition it draws —
 * `'disabled' in def ? def.disabled : def.control?.disabled`, then `setting.setDisabled(...)`, which toggles
 * the row's `is-disabled` class and propagates to every registered component. So a `render` row can carry the
 * predicate too, and `refreshDomState()` re-evaluates it without a re-render — the mechanism
 * `PluginSettingsTabBase.settingEx` builds on.
 *
 * Observed and tested in Obsidian 1.13.4.
 */

export {};

declare module 'obsidian' {
  interface SettingDefinitionRender {
    /**
     * Disables the row. Evaluated on each render and on every `refreshDomState()`. `Setting.setDisabled` is
     * applied to the row, which also disables every component registered on it.
     */
    disabled?: (() => boolean) | boolean;
  }
}
