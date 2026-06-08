/**
 * @file
 *
 * Component that handles async errors by showing a notice to the user.
 */

import { registerAsyncErrorEventHandler } from '../../error.ts';
import { t } from '../i18n/i18n.ts';
import { ComponentEx } from './component-ex.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

/**
 * Registers a global async error handler that shows a notice to the user.
 */
export class AsyncErrorHandlerComponent extends ComponentEx {
  /**
   * Creates a new async error handler component.
   *
   * @param pluginNoticeComponent - The notice component used to display error messages.
   */
  public constructor(private readonly pluginNoticeComponent: PluginNoticeComponent) {
    super();
  }

  /**
   * Registers the error handler.
   */
  public override onload(): void {
    this.register(registerAsyncErrorEventHandler(this.handleAsyncError.bind(this)));
  }

  /**
   * Called when an async error occurs.
   *
   * @param _asyncError - The async error.
   */
  protected handleAsyncError(_asyncError: unknown): void {
    this.pluginNoticeComponent.showNotice(t(($) => $.obsidianDevUtils.notices.unhandledError));
  }
}
