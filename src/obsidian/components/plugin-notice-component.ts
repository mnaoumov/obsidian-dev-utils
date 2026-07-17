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
 * The event passed to {@link PluginNoticeComponentShowNoticeOptions.onCloseClick} when the notice's
 * close (X) button is clicked.
 */
export interface PluginNoticeCloseClickEvent {
  /**
   * Cancels the close, leaving the notice open.
   */
  cancel(): void;
}

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
   * A callback invoked when the user clicks the close (X) button, before the notice is hidden. Call
   * {@link PluginNoticeCloseClickEvent.cancel} on the event to cancel the close and keep the notice
   * open — for example after your own confirmation declines. An async callback is awaited before the
   * notice is hidden. Runs only when a close button is shown (both
   * {@link PluginNoticeComponentShowNoticeOptions.shouldHideOnClick} `= false` and
   * {@link PluginNoticeComponentShowNoticeOptions.shouldShowCloseButton} are set).
   */
  onCloseClick?(this: void, event: PluginNoticeCloseClickEvent): Promisable<void>;

  /**
   * A callback invoked when the notice is hidden — whether by the user closing it, by a later reusable
   * notice replacing it, by its duration elapsing, or on component unload. It runs at most once per
   * notice. The {@link PluginNoticeHideInfo} argument distinguishes a user close (the close button) from
   * a programmatic hide. An async callback is run fire-and-forget (its rejection surfaces through the
   * async-error pipeline).
   */
  onHide?(this: void, info: PluginNoticeHideInfo): Promisable<void>;

  /**
   * Whether clicking the notice hides it. When `true` (the default), the notice dismisses on click like
   * a normal Obsidian notice. When `false`, the notice is hard to close: it does not dismiss on any stray
   * click, and instead shows a close (X) button that hides it directly (see
   * {@link PluginNoticeComponentShowNoticeOptions.shouldShowCloseButton} and
   * {@link PluginNoticeComponentShowNoticeOptions.onCloseClick}).
   *
   * A `shouldHideOnClick: false` notice is shown with an infinite duration and is standalone (implies
   * {@link PluginNoticeComponentShowNoticeOptions.isReusable} `= false`), so a later notice never
   * silently replaces it; passing `isReusable: true` together with `shouldHideOnClick: false` throws.
   *
   * @default `true`
   */
  readonly shouldHideOnClick?: boolean;

  /**
   * Whether the close (X) button is shown on a hard-to-close notice
   * ({@link PluginNoticeComponentShowNoticeOptions.shouldHideOnClick} `= false`). When `false`, no close
   * button is rendered and the notice can only be hidden programmatically. Ignored unless
   * `shouldHideOnClick` is `false`.
   *
   * @default `true`
   */
  readonly shouldShowCloseButton?: boolean;
}

/**
 * Describes why a notice was hidden, passed to {@link PluginNoticeComponentShowNoticeOptions.onHide}.
 */
export interface PluginNoticeHideInfo {
  /**
   * Whether the notice was hidden by the user clicking its close (X) button specifically. Always implies
   * {@link PluginNoticeHideInfo.isUserAction}.
   */
  readonly isCloseButtonClicked: boolean;

  /**
   * Whether the notice was hidden by a user action — clicking the close (X) button, or clicking a
   * dismissible notice to dismiss it — as opposed to programmatically (a later reusable notice replacing
   * it, an explicit `hide()`, the duration elapsing, or component unload).
   */
  readonly isUserAction: boolean;
}

interface PluginNoticeComponentAppendCloseButtonParams {
  readonly contentEl: HTMLElement;
  getNotice(this: void): Notice | null;
  onCloseClick?(this: void, event: PluginNoticeCloseClickEvent): Promisable<void>;
}

interface PluginNoticeComponentBuildDelayedNoticeMessageParams {
  readonly abortController?: AbortController;
  readonly cancelButtonText?: string;
  readonly content: DocumentFragment | string;
}

interface PluginNoticeComponentBuildNoticeContentParams {
  /**
   * Resolves the notice this content belongs to, used by the close button's handler. The notice does
   * not exist yet when the content is built, so it is resolved lazily at click time. Required when a
   * close button is shown.
   */
  getNotice?(this: void): Notice | null;

  /**
   * The message to display after the plugin name prefix.
   */
  readonly message: DocumentFragment | string;

  /**
   * Invoked when the close button is clicked; may cancel the close. See
   * {@link PluginNoticeComponentShowNoticeOptions.onCloseClick}.
   */
  onCloseClick?(this: void, event: PluginNoticeCloseClickEvent): Promisable<void>;

  /**
   * Whether the notice is hard to close: stops every click from dismissing it and, unless suppressed by
   * {@link PluginNoticeComponentBuildNoticeContentParams.shouldShowCloseButton}, adds a close button.
   *
   * @default `false`
   */
  readonly requiresExplicitClose?: boolean;

  /**
   * Whether to render the close button when {@link PluginNoticeComponentBuildNoticeContentParams.requiresExplicitClose}.
   *
   * @default `true`
   */
  readonly shouldShowCloseButton?: boolean;
}

interface PluginNoticeComponentConstructorParams {
  readonly app: App;
  readonly pluginName: string;
}

interface PluginNoticeComponentShowNoticeWithDurationParams {
  readonly durationInMilliseconds: null | number;
  readonly isReusable: boolean;
  readonly message: DocumentFragment | string;
  readonly onCloseClick: ((this: void, event: PluginNoticeCloseClickEvent) => Promisable<void>) | undefined;
  readonly onHide: ((this: void, info: PluginNoticeHideInfo) => Promisable<void>) | undefined;
  readonly requiresExplicitClose: boolean;
  readonly shouldRegisterAsPermanent: boolean;
  readonly shouldShowCloseButton: boolean;
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

  private readonly closeButtonClickedNotices = new WeakSet<Notice>();
  private notice: Notice | null = null;
  private readonly pendingTimerCancellations = new Set<() => void>();
  private readonly standaloneNotices = new Set<Notice>();
  private readonly userClickedNotices = new WeakSet<Notice>();

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
    const shouldHideOnClick = options?.shouldHideOnClick ?? true;
    const requiresExplicitClose = !shouldHideOnClick;
    const isReusable = options?.isReusable ?? !requiresExplicitClose;

    if (options?.isReusable === true && requiresExplicitClose) {
      throw new Error('A notice that does not hide on click cannot be reusable.');
    }
    if (options?.isReusable === false && isPermanent) {
      throw new Error('A permanent notice must be reusable.');
    }

    const durationInMilliseconds = isPermanent || requiresExplicitClose ? PERMANENT_NOTICE_DURATION_IN_MILLISECONDS : null;
    return this.showNoticeWithDuration({
      durationInMilliseconds,
      isReusable,
      message,
      onCloseClick: options?.onCloseClick,
      onHide: options?.onHide,
      requiresExplicitClose,
      shouldRegisterAsPermanent: isPermanent,
      shouldShowCloseButton: options?.shouldShowCloseButton ?? true
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
          onCloseClick: undefined,
          onHide: undefined,
          requiresExplicitClose: false,
          shouldRegisterAsPermanent: false,
          shouldShowCloseButton: true
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
   * Appends a close (X) button to the notice content. Clicking it fires
   * {@link PluginNoticeComponentAppendCloseButtonParams.onCloseClick} (which may cancel the close); if
   * not cancelled, it hides the notice and drops it from the standalone-notice tracking set. The hide is
   * marked as a close-button click so {@link PluginNoticeComponentShowNoticeOptions.onHide} can
   * distinguish it.
   *
   * @param params - The parameters.
   */
  private appendCloseButton(params: PluginNoticeComponentAppendCloseButtonParams): void {
    const { contentEl, getNotice, onCloseClick } = params;
    const closeButtonEl = contentEl.createEl('button', {
      attr: { 'aria-label': t(($) => $.obsidianDevUtils.notices.closeAriaLabel) }
    });
    // Reuse Obsidian's modal close-button classes so this button matches the native modal close button
    // (look and hover); the stylesheet only positions it in the notice corner.
    addPluginCssClasses(closeButtonEl, CssClass.PluginNoticeCloseButton);
    closeButtonEl.addClasses([CssClass.ClickableIcon, CssClass.ModalHeaderButton]);
    setIcon(closeButtonEl, 'x');
    closeButtonEl.addEventListener('click', (evt) => {
      evt.stopPropagation();
      invokeAsyncSafely(async () => {
        let isCancelled = false;
        await onCloseClick?.({
          cancel: (): void => {
            isCancelled = true;
          }
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Can be cancelled by the user.
        if (isCancelled) {
          return;
        }
        const notice = ensureNonNullable(getNotice());
        this.closeButtonClickedNotices.add(notice);
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
    const { getNotice, message, onCloseClick, requiresExplicitClose = false, shouldShowCloseButton = true } = params;
    const fragment = createFragment();
    const contentEl = fragment.createDiv();
    addPluginCssClasses(contentEl, CssClass.PluginNoticeContent);
    contentEl.appendChild(this.buildPrefixedMessage(message));
    contentEl.addEventListener('click', (evt) => {
      // A hard-to-close notice must not dismiss on any stray click; only its close button may hide it.
      if (requiresExplicitClose) {
        evt.stopPropagation();
        return;
      }
      if (evt.target instanceof Element && evt.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        evt.stopPropagation();
      }
    });

    if (requiresExplicitClose && shouldShowCloseButton) {
      this.appendCloseButton(normalizeOptionalProperties<PluginNoticeComponentAppendCloseButtonParams>({
        contentEl,
        getNotice: ensureNonNullable(getNotice),
        onCloseClick
      }));
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
   * @param requiresExplicitClose - Whether the notice requires explicit close; when `false`, nothing is
   * installed.
   */
  private installExplicitCloseGuards(notice: Notice, requiresExplicitClose: boolean): void {
    if (!requiresExplicitClose) {
      return;
    }
    // The outer `.notice` element (`containerEl`) carries Obsidian's dismiss-on-click handler and the
    // Padding a stray click could land on; mark it so the stylesheet drops that padding.
    addPluginCssClasses(notice.containerEl, CssClass.PluginNoticeRequiresExplicitClose);
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

  /**
   * Tracks a click on the notice so {@link PluginNoticeComponentShowNoticeOptions.onHide} can report a
   * user dismissal. Obsidian hides a dismissible notice synchronously during the click, so a
   * capture-phase listener marks the notice before that hide runs; the mark is cleared after the event
   * so a later programmatic hide is not misattributed. A close-button click is tracked separately (see
   * {@link PluginNoticeComponent.appendCloseButton}).
   *
   * @param notice - The notice to track.
   */
  private installUserClickTracking(notice: Notice): void {
    notice.containerEl.addEventListener('click', () => {
      // Obsidian dismisses a dismissible notice synchronously during this click, so mark it now (before
      // That hide runs) and clear it on the next microtask — after any synchronous dismiss, but before a
      // Later programmatic hide, so that hide is not misattributed as a user action.
      this.userClickedNotices.add(notice);
      queueMicrotask(() => {
        this.userClickedNotices.delete(notice);
      });
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
    const { durationInMilliseconds, isReusable, message, onCloseClick, onHide, requiresExplicitClose, shouldRegisterAsPermanent, shouldShowCloseButton } = params;
    // Obsidian's `Notice` treats an omitted duration as its default, so map the `null` "no explicit
    // Duration" value to `undefined`.
    const noticeDurationInMilliseconds = durationInMilliseconds ?? undefined;

    const hasCloseButton = requiresExplicitClose && shouldShowCloseButton;
    // The close button's click handler needs the `Notice`, which does not exist until it is built from
    // This content; capture it lazily via a holder resolved at click time. The getter is created only
    // When a close button is shown.
    let builtNotice: Notice | null = null;
    const content = this.buildNoticeContent(normalizeOptionalProperties<PluginNoticeComponentBuildNoticeContentParams>({
      getNotice: hasCloseButton ? (): Notice | null => builtNotice : undefined,
      message,
      onCloseClick,
      requiresExplicitClose,
      shouldShowCloseButton
    }));

    if (!isReusable) {
      builtNotice = new Notice(content, noticeDurationInMilliseconds);
      this.installExplicitCloseGuards(builtNotice, requiresExplicitClose);
      this.installUserClickTracking(builtNotice);
      this.wireOnHide(builtNotice, onHide);
      this.standaloneNotices.add(builtNotice);
      return builtNotice;
    }

    this.notice?.hide();
    builtNotice = new Notice(content, noticeDurationInMilliseconds);
    this.notice = builtNotice;
    this.installExplicitCloseGuards(builtNotice, requiresExplicitClose);
    this.installUserClickTracking(builtNotice);
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
  private wireOnHide(notice: Notice, onHide: ((this: void, info: PluginNoticeHideInfo) => Promisable<void>) | undefined): void {
    if (!onHide) {
      return;
    }
    // Run `onHide` the first time the notice is hidden. A `once` patch on `hide` intercepts exactly one
    // Call then uninstalls itself (unloading this dedicated component), so there is no manual
    // Single-fire bookkeeping and no lingering patch on the transient notice. The user-close flags were
    // Set before `hide()` was invoked (see `appendCloseButton` / `installUserClickTracking`), so they
    // Still hold when read here after `fallback()`.
    const patchComponent = new MonkeyAroundComponent();
    patchComponent.load();
    patchComponent.registerMethodPatch({
      methodName: 'hide',
      obj: notice,
      once: true,
      patchHandler: ({ fallback }) => {
        fallback();
        const isCloseButtonClicked = this.closeButtonClickedNotices.has(notice);
        const isUserAction = isCloseButtonClicked || this.userClickedNotices.has(notice);
        invokeAsyncSafely(async () => {
          await onHide({ isCloseButtonClicked, isUserAction });
        });
      }
    });
  }
}
