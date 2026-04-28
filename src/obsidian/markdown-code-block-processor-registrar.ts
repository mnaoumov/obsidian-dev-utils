/**
 * @file
 *
 * Registers a markdown code block processor.
 */

import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  Plugin
} from 'obsidian';

import type { MaybeReturn } from '../type.ts';

/**
 * A registrar for markdown code block processors.
 */
export interface MarkdownCodeBlockProcessorRegistrar {
  /**
   * Registers a markdown code block processor.
   *
   * @param language - The language of the code block.
   * @param handler - The handler for the code block.
   * @param sortOrder - The sort order of the code block.
   * @returns The markdown post processor.
   */
  registerMarkdownCodeBlockProcessor(
    language: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => MaybeReturn<Promise<unknown>>,
    sortOrder?: number
  ): MarkdownPostProcessor;
}

/**
 * A registrar for markdown code block processors.
 */
export class PluginMarkdownCodeBlockProcessorRegistrar implements MarkdownCodeBlockProcessorRegistrar {
  private readonly plugin: Plugin;

  /**
   * Creates a new markdown code block processor registrar.
   *
   * @param plugin - The plugin to register the markdown code block processor with.
   */
  public constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Registers a markdown code block processor.
   *
   * @param language - The language of the code block.
   * @param handler - The handler for the code block.
   * @param sortOrder - The sort order of the code block.
   * @returns The markdown post processor.
   */
  public registerMarkdownCodeBlockProcessor(
    language: string,
    handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => MaybeReturn<Promise<unknown>>,
    sortOrder?: number
  ): MarkdownPostProcessor {
    return this.plugin.registerMarkdownCodeBlockProcessor(language, handler, sortOrder);
  }
}
