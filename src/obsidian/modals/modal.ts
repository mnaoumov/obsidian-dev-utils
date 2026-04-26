/**
 * @file
 *
 * This module exports a base class for displaying modals in Obsidian.
 */

import type { App } from 'obsidian';

import { Modal } from 'obsidian';

import type { PromiseResolve } from '../../async.ts';

import { addPluginCssClasses } from '../plugin/plugin-context.ts';

/**
 * Base options for a modal.
 */
export interface ModalParamsBase {
  /**
   * An Obsidian app instance.
   */
  readonly app: App;

  /**
   * A CSS class to apply to the modal.
   */
  readonly cssClasses?: string[];
}

/**
 * A base class for displaying modals in Obsidian.
 */
export abstract class ModalBase<Value> extends Modal {
  /**
   * Creates a new modal.
   *
   * @param params - The options.
   * @param resolve - The resolve function.
   */
  public constructor(params: ModalParamsBase, protected readonly resolve: PromiseResolve<Value>) {
    super(params.app);
    addPluginCssClasses(this.containerEl, params.cssClasses);
  }
}

/**
 * Adds a CSS class to the modal parameters.
 *
 * @param params - The modal parameters.
 * @param cssClass - The CSS class to add.
 * @returns The modal parameters with the CSS class added.
 */
export function addCssClass(params: ModalParamsBase, cssClass: string): ModalParamsBase {
  return {
    ...params,
    cssClasses: [...(params.cssClasses ?? []), cssClass]
  };
}

/**
 * Displays a modal in Obsidian.
 *
 * @param modalCreator - A function that creates a modal.
 * @returns A {@link Promise} that resolves when the modal is closed.
 */
export async function showModal<Value>(modalCreator: (resolve: PromiseResolve<Value>) => Modal): Promise<Value> {
  return await new Promise<Value>((resolve) => {
    const modal = modalCreator(resolve);
    modal.open();
  });
}
