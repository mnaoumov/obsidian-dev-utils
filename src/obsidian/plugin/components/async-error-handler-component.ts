/**
 * @file
 *
 * Component that handles async errors by showing a notice to the user.
 */

import { Component } from 'obsidian';

import { registerAsyncErrorEventHandler } from '../../../error.ts';
import { t } from '../../i18n/i18n.ts';
import { PluginNoticeComponent } from './plugin-notice-component.ts';

/**
 * Registers a global async error handler that shows a notice to the user.
 */
export class AsyncErrorHandlerComponent extends Component {
  /**
   * The singleton key for the {@link AsyncErrorHandlerComponent} class.
   */
  public static readonly COMPONENT_KEY = Symbol(AsyncErrorHandlerComponent.name);

  /**
   * Creates a new async error handler component.
   *
   * @param noticeComponent - The notice component used to display error messages.
   */
  public constructor(private readonly noticeComponent: PluginNoticeComponent) {
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
    this.noticeComponent.showNotice(t(($) => $.obsidianDevUtils.notices.unhandledError));
  }
}
