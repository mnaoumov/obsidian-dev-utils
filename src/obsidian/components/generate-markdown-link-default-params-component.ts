/**
 * @file
 *
 * Component that registers a function providing default params for generated markdown links while it is loaded.
 */

import type { GenerateMarkdownLinkParams } from '../link.ts';

import { getGenerateMarkdownLinkDefaultParamsFns } from '../link.ts';
import { ComponentEx } from './component-ex.ts';

/**
 * Constructor params for {@link GenerateMarkdownLinkDefaultParamsComponent}.
 */
export interface GenerateMarkdownLinkDefaultParamsComponentConstructorParams {
  /**
   * Returns the default {@link GenerateMarkdownLinkParams} to merge into every generated markdown link while this
   * component is loaded.
   *
   * @returns The default params.
   */
  getDefaultParams(this: void): Partial<GenerateMarkdownLinkParams>;
}

/**
 * Registers a function that provides default {@link GenerateMarkdownLinkParams} for the duration of its load.
 *
 * On load the function is appended to the shared list consulted when generating a markdown link; on unload it is
 * removed. Later registrations take precedence over the built-in defaults but never over explicitly passed params.
 */
export class GenerateMarkdownLinkDefaultParamsComponent extends ComponentEx {
  private readonly getDefaultParams: (this: void) => Partial<GenerateMarkdownLinkParams>;

  /**
   * Creates a new component.
   *
   * @param params - The constructor params.
   */
  public constructor(params: GenerateMarkdownLinkDefaultParamsComponentConstructorParams) {
    super();

    this.getDefaultParams = params.getDefaultParams;
  }

  /**
   * Registers the default-params function and schedules its removal on unload.
   */
  public override onload(): void {
    super.onload();

    const fns = getGenerateMarkdownLinkDefaultParamsFns();
    fns.push(this.getDefaultParams);
    this.register(() => {
      fns.remove(this.getDefaultParams);
    });
  }
}
