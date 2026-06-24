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
 * The parameters for constructing a {@link ModalBase}.
 *
 * @typeParam Value - The type of the value resolved by the modal.
 */
export interface ModalBaseConstructorParams<Value> extends ModalParamsBase {
  /**
   * A function to resolve the value of the modal.
   */
  readonly promiseResolve: PromiseResolve<Value>;
}

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
 *
 * @typeParam Value - The type of the value resolved by the modal.
 */
export abstract class ModalBase<Value> extends Modal {
  /**
   * A function to resolve the value of the modal.
   */
  protected readonly promiseResolve: PromiseResolve<Value>;

  /**
   * Creates a new modal.
   *
   * @param params - The options.
   */
  public constructor(params: ModalBaseConstructorParams<Value>) {
    super(params.app);
    this.promiseResolve = params.promiseResolve;
    this.addCssClasses(params.cssClasses);
  }

  /**
   * Adds CSS classes to the modal's container element.
   *
   * @param cssClasses - The CSS classes to add.
   */
  protected addCssClasses(cssClasses?: string | string[]): void {
    addPluginCssClasses(this.containerEl, cssClasses);
  }
}

/**
 * Displays a modal in Obsidian.
 *
 * @typeParam Value - The type of the value resolved by the modal.
 * @param modalCreator - A function that creates a modal.
 * @returns A {@link Promise} that resolves when the modal is closed.
 */
export async function showModal<Value>(modalCreator: (resolve: PromiseResolve<Value>) => Modal): Promise<Value> {
  return await new Promise<Value>((resolve) => {
    const modal = modalCreator(resolve);
    modal.open();
  });
}
