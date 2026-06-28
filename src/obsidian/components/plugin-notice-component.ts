/**
 * @file
 *
 * Component that manages displaying notices to the user.
 */

import { Notice } from 'obsidian';

import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import { ComponentEx } from './component-ex.ts';

const PERMANENT_NOTICES_STATE_KEY = 'plugin-notice-component:permanent-notices';
const PERMANENT_NOTICE_DURATION_IN_MILLISECONDS = 0;

/**
 * Options for {@link PluginNoticeComponent.showNotice}.
 */
export interface PluginNoticeComponentShowNoticeOptions {
  /**
   * Whether the notice should stay until it is replaced, the plugin is reloaded, or the user dismisses it.
   *
   * A permanent notice is shown with an infinite duration and is not hidden when the component unloads, so it can
   * communicate state that outlives the plugin (e.g. a cleanup that requires a reload). There is at most one permanent
   * notice per plugin: it is hidden by the next {@link PluginNoticeComponent.showNotice} call and dismissed
   * automatically the next time the component loads (i.e. when the plugin is re-enabled).
   *
   * @default `false`
   */
  readonly isPermanent?: boolean;
}

/**
 * Manages showing plugin notices. Automatically hides the previous notice when a new one is shown.
 */
export class PluginNoticeComponent extends ComponentEx {
  private notice: Notice | null = null;

  /**
   * Creates a new plugin notice component.
   *
   * @param pluginName - The plugin name (shown as prefix in notices).
   */
  public constructor(private readonly pluginName: string) {
    super();
  }

  /**
   * Dismisses the permanent notice left over from a previous load (e.g. a previous plugin session) on load.
   */
  public override onload(): void {
    super.onload();
    const permanentNotice = this.getPermanentNotice();
    permanentNotice?.hide();
    this.setPermanentNotice(null);
  }

  /**
   * Hides the current notice on unload, unless it is the permanent notice (which is meant to outlive the plugin).
   */
  public override onunload(): void {
    if (this.getPermanentNotice() !== this.notice) {
      this.notice?.hide();
    }
  }

  /**
   * Displays a notice message to the user.
   *
   * @param message - The message to display.
   * @param options - The options for displaying the notice.
   * @returns The notice object.
   */
  public showNotice(message: DocumentFragment | string, options?: PluginNoticeComponentShowNoticeOptions): Notice {
    this.notice?.hide();

    const prefix = `${this.pluginName}${this._loaded ? '' : ' (unloaded)'}\n`;
    const prefixedMessage = prependPrefix(prefix, message);
    this.notice = new Notice(prefixedMessage, options?.isPermanent ? PERMANENT_NOTICE_DURATION_IN_MILLISECONDS : undefined);

    if (options?.isPermanent) {
      this.setPermanentNotice(this.notice);
    } else {
      this.setPermanentNotice(null);
    }
    return this.notice;
  }

  private getPermanentNotice(): Notice | null {
    return this.getPermanentNotices().get(this.pluginName) ?? null;
  }

  private getPermanentNotices(): Map<string, Notice> {
    return getObsidianDevUtilsState<Map<string, Notice>>(PERMANENT_NOTICES_STATE_KEY, new Map<string, Notice>()).value;
  }

  private setPermanentNotice(notice: Notice | null): void {
    const map = this.getPermanentNotices();
    if (notice) {
      map.set(this.pluginName, notice);
    } else {
      map.delete(this.pluginName);
    }
  }
}

function prependPrefix(prefix: string, message: DocumentFragment | string): DocumentFragment | string {
  if (typeof message === 'string') {
    return `${prefix}${message}`;
  }

  message.prepend(prefix);
  return message;
}
