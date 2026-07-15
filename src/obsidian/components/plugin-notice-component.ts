/**
 * @file
 *
 * Component that manages displaying notices to the user.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import {
  ButtonComponent,
  Notice,
  setIcon
} from 'obsidian';

import type { ValueProvider } from '../../value-provider.ts';

import { invokeAsyncSafely } from '../../async.ts';
import { normalizeOptionalProperties } from '../../object-utils.ts';
import { getObsidianDevUtilsState } from '../../obsidian-dev-utils-state.ts';
import { ensureNonNullable } from '../../type-guards.ts';
import { resolveValue } from '../../value-provider.ts';
import { CssClass } from '../css-class.ts';
import { t } from '../i18n/i18n.ts';
import { confirm } from '../modals/confirm.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';
import { ComponentEx } from './component-ex.ts';
import { MonkeyAroundComponent } from './monkey-around-component.ts';

const PERMANENT_NOTICES_STATE_KEY = 'plugin-notice-component:permanent-notices';
const PERMANENT_NOTICE_DURATION_IN_MILLISECONDS = 0;
const DEFAULT_DELAY_BEFORE_SHOW_IN_MILLISECONDS = 500;

// Elements a user clicks to act on them rather than to dismiss the notice. A click landing on (or
// Inside) one of these is kept from bubbling to the notice, so the notice stays open.
const INTERACTIVE_ELEMENT_SELECTOR = 'a, button, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="tab"], [role="menuitem"]';

/**
 * A handle to a delayed notice created by {@link PluginNoticeComponent.showNoticeAfterDelay}. It is a
 * {@link Disposable} (so it can be used with `using`) that also lets the content be updated while the
 * notice is shown.
 */
export interface PluginNoticeComponentDelayedNotice extends Disposable {
  /**
   * Replaces the notice content, re-applying the plugin-name prefix, the interactive-click guard, and
   * the Cancel button. Useful for reporting progress. If the delay has not elapsed yet, the new content
   * becomes what is shown once it does.
   *
   * @param content - The new notice content.
   */
  setContent(content: DocumentFragment | string): void;
}

/**
 * Parameters for {@link PluginNoticeComponent.showNoticeAfterDelay}.
 */
export interface PluginNoticeComponentShowNoticeAfterDelayParams {
  /**
   * When provided, a Cancel button is appended to the notice; clicking it aborts this controller. When
   * omitted, no Cancel button is shown.
   */
  readonly abortController?: AbortController;

  /**
   * The text of the Cancel button shown when {@link PluginNoticeComponentShowNoticeAfterDelayParams.abortController}
   * is provided. When omitted, the localized `Cancel` label is used.
   */
  readonly cancelButtonText?: string;

  /**
   * The notice content, resolved lazily only if the delay elapses — so an operation that finishes
   * sooner never builds it.
   */
  readonly content: ValueProvider<DocumentFragment | string>;

  /**
   * How long the operation must run before the notice is shown. Operations that finish sooner never
   * show a notice, avoiding a distracting flash.
   *
   * @default `500`
   */
  readonly delayInMilliseconds?: number;
}

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

  /**
   * Whether the notice occupies the single per-plugin reusable slot.
   *
   * A reusable notice takes the shared slot: the next reusable notice hides it, and it is hidden on unload.
   * A non-reusable (standalone) notice is not placed in the slot — it never hides, and is never hidden by, a
   * reusable notice; multiple standalone notices coexist. Standalone notices are still hidden together on unload.
   *
   * A permanent notice must be reusable ({@link PluginNoticeComponentShowNoticeOptions.isPermanent} implies
   * `isReusable`); passing `isReusable: false` together with `isPermanent: true` throws.
   *
   * @default `true`
   */
  readonly isReusable?: boolean;

  /**
   * A callback invoked when the notice is hidden — whether by the user closing it, by a later reusable
   * notice replacing it, by its duration elapsing, or on component unload. It runs at most once per
   * notice. An async callback is run fire-and-forget (its rejection surfaces through the async-error
   * pipeline).
   */
  onHide?(this: void): Promisable<void>;

  /**
   * Whether the notice is hard to close: it does not dismiss on any stray click, and instead shows a
   * close (X) button whose click opens a confirmation modal, dismissing the notice only if confirmed.
   *
   * A hard-to-close notice is shown with an infinite duration and is standalone (implies
   * {@link PluginNoticeComponentShowNoticeOptions.isReusable} `= false`), so a later notice never
   * silently replaces it; passing `isReusable: true` together with `requiresCloseConfirmation: true`
   * throws.
   *
   * @default `false`
   */
  readonly requiresCloseConfirmation?: boolean;
}

interface PluginNoticeComponentBuildDelayedNoticeMessageParams {
  readonly abortController?: AbortController;
  readonly cancelButtonText?: string;
  readonly content: DocumentFragment | string;
}

interface PluginNoticeComponentBuildNoticeContentParams {
  /**
   * Resolves the notice this content belongs to, used by the close button's handler. The notice does
   * not exist yet when the content is built, so it is resolved lazily at click time. Required when
   * {@link PluginNoticeComponentBuildNoticeContentParams.requiresCloseConfirmation} is `true`.
   */
  getNotice?(this: void): Notice | null;

  /**
   * The message to display after the plugin name prefix.
   */
  readonly message: DocumentFragment | string;

  /**
   * Whether the notice is hard to close: stops every click from dismissing it and adds a close button
   * guarded by a confirmation modal.
   *
   * @default `false`
   */
  readonly requiresCloseConfirmation?: boolean;
}

interface PluginNoticeComponentConstructorParams {
  readonly app: App;
  readonly pluginName: string;
}

interface PluginNoticeComponentShowNoticeWithDurationParams {
  readonly durationInMilliseconds: null | number;
  readonly isReusable: boolean;
  readonly message: DocumentFragment | string;
  readonly onHide: (() => Promisable<void>) | undefined;
  readonly requiresCloseConfirmation: boolean;
  readonly shouldRegisterAsPermanent: boolean;
}

/**
 * Manages showing plugin notices. Automatically hides the previous notice when a new one is shown.
 */
export class PluginNoticeComponent extends ComponentEx {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The plugin name (shown as prefix in notices).
   */
  protected readonly pluginName: string;

  private notice: Notice | null = null;
  private readonly pendingTimerCancellations = new Set<() => void>();
  private readonly standaloneNotices = new Set<Notice>();

  /**
   * Creates a new plugin notice component.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginNoticeComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginName = params.pluginName;
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
    // Cancel any delayed notice whose timer has not fired yet, so it never appears after unload.
    for (const cancelPendingTimer of [...this.pendingTimerCancellations]) {
      cancelPendingTimer();
    }
    if (this.getPermanentNotice() !== this.notice) {
      this.notice?.hide();
    }
    for (const standaloneNotice of this.standaloneNotices) {
      standaloneNotice.hide();
    }
    this.standaloneNotices.clear();
  }

  /**
   * Displays a notice message to the user.
   *
   * @param message - The message to display.
   * @param options - The options for displaying the notice.
   * @returns The notice object.
   */
  public showNotice(message: DocumentFragment | string, options?: PluginNoticeComponentShowNoticeOptions): Notice {
    const isPermanent = options?.isPermanent ?? false;
    const requiresCloseConfirmation = options?.requiresCloseConfirmation ?? false;
    const isReusable = options?.isReusable ?? !requiresCloseConfirmation;

    if (options?.isReusable === true && requiresCloseConfirmation) {
      throw new Error('A notice that requires close confirmation cannot be reusable.');
    }
    if (options?.isReusable === false && isPermanent) {
      throw new Error('A permanent notice must be reusable.');
    }

    const durationInMilliseconds = isPermanent || requiresCloseConfirmation ? PERMANENT_NOTICE_DURATION_IN_MILLISECONDS : null;
    return this.showNoticeWithDuration({
      durationInMilliseconds,
      isReusable,
      message,
      onHide: options?.onHide,
      requiresCloseConfirmation,
      shouldRegisterAsPermanent: isPermanent
    });
  }

  /**
   * Shows a notice describing a long-running operation, but only once the operation has run for longer
   * than {@link PluginNoticeComponentShowNoticeAfterDelayParams.delayInMilliseconds} — so operations
   * that finish sooner never flash a notice. The notice stays until the returned {@link Disposable} is
   * disposed (which also cancels the pending timer if it has not fired yet), so it can be used with
   * `using`. When an {@link PluginNoticeComponentShowNoticeAfterDelayParams.abortController} is given, a
   * Cancel button that aborts it is appended (and, being interactive, does not dismiss the notice).
   *
   * @example
   * ```ts
   * using _notice = pluginNoticeComponent.showNoticeAfterDelay({
   *   abortController,
   *   content: () => buildProgressFragment()
   * });
   * await runOperation(abortController.signal);
   * ```
   *
   * @param params - The parameters.
   * @returns A {@link PluginNoticeComponentDelayedNotice} that hides the notice (or cancels the pending
   * timer) when disposed and lets the content be updated while it is shown.
   */
  public showNoticeAfterDelay(params: PluginNoticeComponentShowNoticeAfterDelayParams): PluginNoticeComponentDelayedNotice {
    let shownNotice: Notice | null = null;
    let isDisposed = false;
    let timerId = 0;
    let currentContent: ValueProvider<DocumentFragment | string> = params.content;

    const cancelPendingTimer = (): void => {
      window.clearTimeout(timerId);
      this.pendingTimerCancellations.delete(cancelPendingTimer);
    };

    const buildDelayedMessage = (content: DocumentFragment | string): DocumentFragment =>
      this.buildDelayedNoticeMessage(normalizeOptionalProperties<PluginNoticeComponentBuildDelayedNoticeMessageParams>({
        abortController: params.abortController,
        cancelButtonText: params.cancelButtonText,
        content
      }));

    timerId = window.setTimeout(() => {
      cancelPendingTimer();
      invokeAsyncSafely(async () => {
        const resolvedContent = await resolveValue(currentContent, {});
        // The handle may have been disposed while the content was being resolved; don't show a stale notice.
        if (isDisposed) {
          return;
        }
        shownNotice = this.showNoticeWithDuration({
          durationInMilliseconds: PERMANENT_NOTICE_DURATION_IN_MILLISECONDS,
          isReusable: true,
          message: buildDelayedMessage(resolvedContent),
          onHide: undefined,
          requiresCloseConfirmation: false,
          shouldRegisterAsPermanent: false
        });
      });
    }, params.delayInMilliseconds ?? DEFAULT_DELAY_BEFORE_SHOW_IN_MILLISECONDS);

    this.pendingTimerCancellations.add(cancelPendingTimer);

    return {
      setContent: (content: DocumentFragment | string): void => {
        currentContent = content;
        // Re-wrap so the prefix, interactive guard, and Cancel button survive the content swap.
        shownNotice?.setMessage(this.buildNoticeContent({ message: buildDelayedMessage(content) }));
      },
      [Symbol.dispose]: (): void => {
        isDisposed = true;
        cancelPendingTimer();
        shownNotice?.hide();
        if (this.notice === shownNotice) {
          this.notice = null;
        }
      }
    };
  }

  /**
   * Appends a close (X) button to the notice content. Clicking it opens a confirmation modal and, only
   * if confirmed, hides the notice and drops it from the standalone-notice tracking set.
   *
   * @param contentEl - The notice content wrapper to append the button to.
   * @param getNotice - Resolves the notice to hide when the close is confirmed.
   */
  private appendCloseButton(contentEl: HTMLElement, getNotice: () => Notice | null): void {
    const closeButtonEl = contentEl.createEl('button', {
      attr: { 'aria-label': t(($) => $.obsidianDevUtils.notices.closeAriaLabel) }
    });
    addPluginCssClasses(closeButtonEl, CssClass.PluginNoticeCloseButton);
    setIcon(closeButtonEl, 'x');
    closeButtonEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      invokeAsyncSafely(async () => {
        const isConfirmed = await confirm({
          app: this.app,
          message: t(($) => $.obsidianDevUtils.notices.closeConfirmMessage)
        });
        if (!isConfirmed) {
          return;
        }
        const notice = ensureNonNullable(getNotice());
        notice.hide();
        this.standaloneNotices.delete(notice);
      });
    });
  }

  /**
   * Builds the message for a delayed notice: the resolved content, optionally followed by a Cancel
   * button that aborts the provided controller when clicked.
   *
   * @param params - The parameters.
   * @returns A {@link DocumentFragment} holding the content and, if requested, a Cancel button.
   */
  private buildDelayedNoticeMessage(params: PluginNoticeComponentBuildDelayedNoticeMessageParams): DocumentFragment {
    const { abortController, cancelButtonText, content } = params;
    const fragment = createFragment();
    if (typeof content === 'string') {
      fragment.appendText(content);
    } else {
      fragment.appendChild(content);
    }

    if (abortController) {
      // `ButtonComponent` requires an `HTMLElement` parent, so build it on a throwaway
      // Detached element and move its `buttonEl` into the fragment.
      const cancelButton = new ButtonComponent(createDiv());
      cancelButton.setButtonText(cancelButtonText ?? t(($) => $.obsidianDevUtils.buttons.cancel));
      addPluginCssClasses(cancelButton.buttonEl, CssClass.CancelButton);
      // The click is wired via `addEventListener` rather than `ButtonComponent.onClick` so it
      // Bubbles through the interactive-element guard (keeping the notice open) and stays
      // Directly exercisable via a dispatched DOM event in unit tests.
      cancelButton.buttonEl.addEventListener('click', () => {
        abortController.abort();
      });
      fragment.appendChild(cancelButton.buttonEl);
    }
    return fragment;
  }

  /**
   * Builds the notice content wrapped in a container that keeps the notice open when an interactive
   * element inside it is clicked. Obsidian dismisses a notice on any click that bubbles up to its
   * element; the container intercepts clicks originating on an interactive element (a link, button,
   * input, etc.) and stops them there, so the element's own handler still runs but the notice stays.
   *
   * @param params - The parameters.
   * @returns A {@link DocumentFragment} holding the wrapped, prefixed notice content.
   */
  private buildNoticeContent(params: PluginNoticeComponentBuildNoticeContentParams): DocumentFragment {
    const { getNotice, message, requiresCloseConfirmation = false } = params;
    const fragment = createFragment();
    const contentEl = fragment.createDiv();
    addPluginCssClasses(contentEl, CssClass.PluginNoticeContent);
    contentEl.appendChild(this.buildPrefixedMessage(message));
    contentEl.addEventListener('click', (evt) => {
      // A hard-to-close notice must not dismiss on any stray click; only its close button (via the
      // Confirmation modal) may dismiss it.
      if (requiresCloseConfirmation) {
        evt.stopPropagation();
        return;
      }
      if (evt.target instanceof Element && evt.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        evt.stopPropagation();
      }
    });

    if (requiresCloseConfirmation) {
      this.appendCloseButton(contentEl, ensureNonNullable(getNotice));
    }
    return fragment;
  }

  /**
   * Builds the notice content, prefixing the message with the plugin name in a styled element so it is
   * visually distinguished from the message body.
   *
   * @param message - The message to display after the plugin name prefix.
   * @returns A {@link DocumentFragment} with the styled plugin name prefix followed by the message.
   */
  private buildPrefixedMessage(message: DocumentFragment | string): DocumentFragment {
    const fragment = createFragment();
    const nameEl = createSpan({ text: this.pluginName });
    addPluginCssClasses(nameEl, CssClass.PluginNoticeName);
    fragment.appendChild(nameEl);
    if (!this._loaded) {
      fragment.appendText(' (unloaded)');
    }
    fragment.appendText('\n');
    if (typeof message === 'string') {
      fragment.appendText(message);
    } else {
      fragment.appendChild(message);
    }
    return fragment;
  }

  private getPermanentNotice(): Notice | null {
    return this.getPermanentNotices().get(this.pluginName) ?? null;
  }

  private getPermanentNotices(): Map<string, Notice> {
    return getObsidianDevUtilsState<Map<string, Notice>>(PERMANENT_NOTICES_STATE_KEY, new Map<string, Notice>()).value;
  }

  /**
   * Makes a notice hard to close: marks its outer element (so the CSS neutralizes its padding) and
   * installs a capture-phase click guard that stops every click except on an interactive element (a
   * button, link, the close button, etc.) from reaching Obsidian's own dismiss handler — so an
   * interactive child's own handler still runs while a stray click cannot dismiss the notice.
   *
   * @param notice - The notice to guard.
   * @param requiresCloseConfirmation - Whether the notice requires close confirmation; when `false`,
   * nothing is installed.
   */
  private installCloseConfirmationGuards(notice: Notice, requiresCloseConfirmation: boolean): void {
    if (!requiresCloseConfirmation) {
      return;
    }
    // The outer `.notice` element (`containerEl`) carries Obsidian's dismiss-on-click handler and the
    // Padding a stray click could land on; mark it so the stylesheet drops that padding.
    addPluginCssClasses(notice.containerEl, CssClass.PluginNoticeRequiresConfirmation);
    // Stop every click on the notice — except on an interactive element — from reaching Obsidian's
    // Dismiss handler. Registered in the capture phase on the outermost element so it always runs first.
    // Letting a click reach an interactive child (a button, link, the close button, etc.) is what keeps
    // Its own handler working; the bubble-phase guard on the content wrapper then stops that click from
    // Bubbling up to Obsidian's dismiss handler, so the notice still stays open.
    notice.containerEl.addEventListener('click', (evt) => {
      if (evt.target instanceof Element && evt.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        return;
      }
      evt.stopPropagation();
    }, { capture: true });
  }

  private setPermanentNotice(notice: Notice | null): void {
    const map = this.getPermanentNotices();
    if (notice) {
      map.set(this.pluginName, notice);
    } else {
      map.delete(this.pluginName);
    }
  }

  /**
   * Shows a notice with the given duration. A reusable notice replaces the current reusable notice (and
   * is optionally registered as this plugin's permanent notice); a standalone notice is tracked
   * separately, leaving the reusable slot untouched.
   *
   * @param params - The parameters.
   * @returns The created notice.
   */
  private showNoticeWithDuration(params: PluginNoticeComponentShowNoticeWithDurationParams): Notice {
    const { durationInMilliseconds, isReusable, message, onHide, requiresCloseConfirmation, shouldRegisterAsPermanent } = params;
    // Obsidian's `Notice` treats an omitted duration as its default, so map the `null` "no explicit
    // Duration" value to `undefined`.
    const noticeDurationInMilliseconds = durationInMilliseconds ?? undefined;

    // The close button's confirm handler needs the `Notice`, which does not exist until it is built from
    // This content; capture it lazily via a holder resolved at click time. The getter is created only
    // For a hard-to-close notice — the only kind that has a close button.
    let builtNotice: Notice | null = null;
    const content = this.buildNoticeContent(normalizeOptionalProperties<PluginNoticeComponentBuildNoticeContentParams>({
      getNotice: requiresCloseConfirmation ? (): Notice | null => builtNotice : undefined,
      message,
      requiresCloseConfirmation
    }));

    if (!isReusable) {
      builtNotice = new Notice(content, noticeDurationInMilliseconds);
      this.installCloseConfirmationGuards(builtNotice, requiresCloseConfirmation);
      this.wireOnHide(builtNotice, onHide);
      this.standaloneNotices.add(builtNotice);
      return builtNotice;
    }

    this.notice?.hide();
    builtNotice = new Notice(content, noticeDurationInMilliseconds);
    this.notice = builtNotice;
    this.installCloseConfirmationGuards(builtNotice, requiresCloseConfirmation);
    this.wireOnHide(builtNotice, onHide);

    if (shouldRegisterAsPermanent) {
      this.setPermanentNotice(builtNotice);
    } else {
      this.setPermanentNotice(null);
    }
    return builtNotice;
  }

  /**
   * Wraps a notice's `hide` so the given callback runs the first time the notice is hidden — by the
   * user, by a replacing notice, by its duration elapsing, or on unload. Does nothing when no callback
   * is given.
   *
   * @param notice - The notice whose `hide` to wrap.
   * @param onHide - The callback to invoke on the first hide, or `undefined` to skip wrapping.
   */
  private wireOnHide(notice: Notice, onHide: (() => Promisable<void>) | undefined): void {
    if (!onHide) {
      return;
    }
    // Run `onHide` the first time the notice is hidden. A `once` patch on `hide` intercepts exactly one
    // Call then uninstalls itself (unloading this dedicated component), so there is no manual
    // Single-fire bookkeeping and no lingering patch on the transient notice.
    const patchComponent = new MonkeyAroundComponent();
    patchComponent.load();
    patchComponent.registerMethodPatch({
      methodName: 'hide',
      obj: notice,
      once: true,
      patchHandler: ({ fallback }) => {
        fallback();
        invokeAsyncSafely(async () => {
          await onHide();
        });
      }
    });
  }
}
