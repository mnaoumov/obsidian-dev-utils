/**
 * @packageDocumentation
 *
 * This module exports a base class for displaying modals in Obsidian.
 */

import type { App } from 'obsidian';

import { Modal } from 'obsidian';

import type { PromiseResolve } from '../../Async.ts';

import { CssClass } from '../../CssClass.ts';
import { getPluginId } from '../Plugin/PluginId.ts';

/**
 * The base options for a modal.
 */
export interface ModalOptionsBase {
  /**
   * The application instance.
   */
  app: App;

  /**
   * The CSS class to apply to the modal.
   */
  cssClass?: string;
}

/**
 * A base class for displaying modals in Obsidian.
 */
export abstract class ModalBase<Value, Options extends ModalOptionsBase> extends Modal {
  /**
   * Creates a new modal.
   *
   * @param options - The options.
   * @param resolve - The resolve function.
   * @param modalCssClass - The modal CSS class.
   */
  public constructor(options: Options, protected resolve: PromiseResolve<Value>, modalCssClass: string) {
    super(options.app);
    this.containerEl.addClass(CssClass.LibraryName, getPluginId(), modalCssClass);
    if (options.cssClass) {
      this.containerEl.addClass(options.cssClass);
    }
  }
}

/**
 * Displays a modal in Obsidian.
 *
 * @param modalCreator - A function that creates a modal.
 * @returns A {@link Promise} that resolves when the modal is closed.
 */
export async function showModal<T>(modalCreator: (resolve: PromiseResolve<T>) => Modal): Promise<T> {
  return await new Promise<T>((resolve) => {
    const modal = modalCreator(resolve);
    modal.open();
  });
}
