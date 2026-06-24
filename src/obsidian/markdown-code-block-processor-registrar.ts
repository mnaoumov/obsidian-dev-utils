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
import type { Promisable } from 'type-fest';

import { normalizePromisable } from '../async.ts';

/**
 * A registrar for markdown code block processors.
 */
export interface MarkdownCodeBlockProcessorRegistrar {
  /**
   * Registers a markdown code block processor.
   *
   * @param params - The parameters for the markdown code block processor.
   * @returns The markdown post processor.
   */
  registerMarkdownCodeBlockProcessor(params: MarkdownCodeBlockProcessorRegistrarRegisterMarkdownCodeBlockProcessorParams): MarkdownPostProcessor;
}

interface MarkdownCodeBlockProcessorRegistrarRegisterMarkdownCodeBlockProcessorParams {
  /**
   * Handler function for the code block processor.
   *
   * @param source - The source code of the code block.
   * @param el - The HTML element representing the code block.
   * @param ctx - The context for the markdown post processor.
   */
  handler(this: void, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promisable<void>;

  /**
   * The language of the code block to register the processor for.
   */
  readonly language: string;

  /**
   * The sort order of the processor. Lower numbers are processed first. Defaults to 0.
   */
  readonly sortOrder?: number;
}

type PluginMarkdownCodeBlockProcessorRegistrarRegisterMarkdownCodeBlockProcessorParams = MarkdownCodeBlockProcessorRegistrarRegisterMarkdownCodeBlockProcessorParams;

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
   * @param params - The parameters for the markdown code block processor.
   * @returns The markdown post processor.
   */
  public registerMarkdownCodeBlockProcessor(params: PluginMarkdownCodeBlockProcessorRegistrarRegisterMarkdownCodeBlockProcessorParams): MarkdownPostProcessor {
    return this.plugin.registerMarkdownCodeBlockProcessor(params.language, (source, el, ctx) => normalizePromisable(params.handler(source, el, ctx)), params.sortOrder);
  }
}
