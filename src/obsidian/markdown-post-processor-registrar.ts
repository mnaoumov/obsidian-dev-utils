/**
 * @file
 *
 * Markdown post processor registrars.
 */

import type { MarkdownPostProcessorContext } from 'obsidian';
import type { Promisable } from 'type-fest';

import { Plugin } from 'obsidian';

import { normalizePromisable } from '../async.ts';

/**
 * Markdown post processor registrar.
 */
export interface MarkdownPostProcessorRegistrar {
  /**
   * Registers a markdown post processor.
   *
   * @param params - The parameters for the markdown post processor registration.
   */
  registerMarkdownPostProcessor(params: MarkdownPostProcessorRegistrarRegisterMarkdownPostProcessorParams): void;
}

/**
 * Parameters for registering a markdown post processor.
 */
export interface MarkdownPostProcessorRegistrarRegisterMarkdownPostProcessorParams {
  /**
   * Post processor function to register.
   *
   * @param el - The HTML element to process.
   * @param ctx - The markdown post processor context.
   * @returns A promisable that resolves when the post processing is complete.
   */
  postProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promisable<void>;

  /**
   * Optional sort order for the post processor. Lower numbers are processed first. Default is 0.
   */
  readonly sortOrder?: number;
}

type PluginMarkdownPostProcessorRegistrarRegisterMarkdownPostProcessorParams = MarkdownPostProcessorRegistrarRegisterMarkdownPostProcessorParams;

/**
 * Markdown post processor registrar in an Obsidian plugin.
 */
export class PluginMarkdownPostProcessorRegistrar implements MarkdownPostProcessorRegistrar {
  /**
   * Creates a new instance of the {@link PluginMarkdownPostProcessorRegistrar} class.
   *
   * @param plugin - The Obsidian plugin instance.
   */
  public constructor(private readonly plugin: Plugin) {}

  /**
   * Registers a markdown post processor.
   *
   * @param params - The parameters for the markdown post processor registration.
   */
  public registerMarkdownPostProcessor(params: PluginMarkdownPostProcessorRegistrarRegisterMarkdownPostProcessorParams): void {
    this.plugin.registerMarkdownPostProcessor((el, ctx) => normalizePromisable(params.postProcessor(el, ctx)), params.sortOrder);
  }
}
