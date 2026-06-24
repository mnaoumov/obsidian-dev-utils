/**
 * @file
 *
 * Editor extension registrars.
 */

import type { Extension } from '@codemirror/state';

import { Plugin } from 'obsidian';

/**
 * Editor extension registrar.
 */
export interface EditorExtensionRegistrar {
  /**
   * Registers an editor extension.
   *
   * @param extension - The editor extension to register.
   */
  registerEditorExtension(extension: Extension): void;
}

/**
 * Editor extension registrar in an Obsidian plugin.
 */
export class PluginEditorExtensionRegistrar implements EditorExtensionRegistrar {
  /**
   * Creates a new instance of the {@link PluginEditorExtensionRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers an editor extension.
   *
   * @param extension - The editor extension to register.
   */
  public registerEditorExtension(extension: Extension): void {
    this.plugin.registerEditorExtension(extension);
  }
}
