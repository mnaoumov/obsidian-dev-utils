/**
 * @file
 *
 * Editor suggest registrars.
 */

import {
  EditorSuggest,
  Plugin
} from 'obsidian';

/**
 * Editor suggest registrar.
 */
export interface EditorSuggestRegistrar {
  /**
   * Registers an editor suggest.
   *
   * @param editorSuggest - The editor suggest to register.
   */
  registerEditorSuggest(editorSuggest: EditorSuggest<unknown>): void;
}

/**
 * Editor suggest registrar in an Obsidian plugin.
 */
export class PluginEditorSuggestRegistrar implements EditorSuggestRegistrar {
  /**
   * Creates a new instance of the {@link PluginEditorSuggestRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(protected readonly plugin: Plugin) {}

  /**
   * Registers an editor suggest.
   *
   * @param editorSuggest - The editor suggest to register.
   */
  public registerEditorSuggest(editorSuggest: EditorSuggest<unknown>): void {
    this.plugin.registerEditorSuggest(editorSuggest);
  }
}
