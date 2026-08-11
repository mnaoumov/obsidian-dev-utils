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

import { snapshot } from '../../array.ts';
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
// Obsidian's own default notice duration, applied by the `Notice` constructor when none is given. It is
// Repeated here because restarting the countdown on an append goes through `setAutoHide`, which takes an
// Explicit duration and so cannot fall back to that default itself.
const OBSIDIAN_DEFAULT_NOTICE_DURATION_IN_MILLISECONDS = 4000;

// Elements a user clicks to act on them rather than to dismiss the notice. A click landing on (or
// Inside) one of these is kept from bubbling to the notice, so the notice stays open.
const INTERACTIVE_ELEMENT_SELECTOR = 'a, button, input, select, textarea, label, [contenteditable="true"], [role="button"], [role="link"], [role="checkbox"], [role="tab"], [role="menuitem"]';

/**
 * How a new notice relates to the plugin's current notice — the one occupying the single per-plugin
 * slot this component keeps.
 *
 * Raw `new Notice(...)` calls always pile up, which is rarely what a plugin wants: usually only the
 * latest message matters. So the slot exists, and this chooses what a new message does with it.
 */
export enum PluginNoticeMode {
  /**
   * Adds the message to the current notice, so both messages stay visible in a single notice — for a
   * running account of an operation. The countdown restarts, so an appended message is readable for a
   * full duration rather than inheriting the remains of the current one.
   *
   * Falls back to {@link PluginNoticeMode.Replace} when there is no current notice on screen (it was
   * never shown, or it has since been dismissed).
   */
  Append = 'append',

  /**
   * Hides the current notice and shows this one in its place, so only the latest message is on screen.
   * This is the default, and the reason the slot exists.
   */
  Replace = 'replace',

  /**
   * Shows the message as its own notice, leaving the current one alone: both are on screen, piled up
   * like plain `new Notice(...)` calls. A separate notice never replaces, and is never replaced by, a
   * slot notice; any number of them coexist. They are still hidden together on unload.
   */
  Separate = 'separate'
}

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
   * Replaces this handle's message, re-applying the plugin-name prefix, the interactive-click guard, and
   * the Cancel button. Useful for reporting progress. If the delay has not elapsed yet, the new content
   * becomes what is shown once it does.
   *
   * Only this handle's own message is rewritten: when the notice was joined rather than opened (see
   * {@link PluginNoticeComponentShowNoticeAfterDelayParams.mode}), the messages already in it are left
   * alone.
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

  /**
   * How this notice relates to the plugin's current notice — see {@link PluginNoticeMode}.
   *
   * {@link PluginNoticeMode.Separate} is worth considering for a long operation: on the default
   * {@link PluginNoticeMode.Replace} the progress notice takes the shared slot, so any ordinary notice
   * raised while the operation runs hides it, and the progress the user was watching does not come back.
   *
   * Whichever mode is used, the returned handle owns only ITS message: updating the content rewrites
   * that message alone, and disposing takes away only that message when the notice was already on
   * screen (a notice this handle opened is hidden as a whole).
   *
   * @default {@link PluginNoticeMode.Replace}
   */
  readonly mode?: PluginNoticeMode;
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
   * How this notice relates to the plugin's current notice — see {@link PluginNoticeMode}.
   *
   * A permanent notice cannot be {@link PluginNoticeMode.Separate} (it needs the shared slot it is
   * tracked in), and a notice that does not hide on click must be
   * {@link PluginNoticeMode.Separate} (so a later notice never silently replaces it); either
   * contradiction throws.
   *
   * @default {@link PluginNoticeMode.Replace}, or {@link PluginNoticeMode.Separate} when
   * {@link PluginNoticeComponentShowNoticeOptions.shouldHideOnClick} is `false`
   */
  readonly mode?: PluginNoticeMode;

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
   * A `shouldHideOnClick: false` notice is shown with an infinite duration and stands on its own
   * (implies {@link PluginNoticeMode.Separate}), so a later notice never silently replaces it; passing
   * any other {@link PluginNoticeComponentShowNoticeOptions.mode} together with `shouldHideOnClick: false`
   * throws.
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

interface PluginNoticeComponentAppendToCurrentNoticeParams {
  readonly durationInMilliseconds: null | number;
  readonly message: DocumentFragment | string;
  onHide?(this: void, info: PluginNoticeHideInfo): Promisable<void>;
  readonly shouldRegisterAsPermanent: boolean;
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
   * Whether the message is prefixed with the plugin name. Only a message that opens a notice is
   * prefixed; a message appended to one already showing it is not, so the name is not repeated on every
   * line.
   *
   * @default `true`
   */
  readonly shouldPrefixWithPluginName?: boolean;

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

/**
 * A built message: the wrapper element holding it, and the fragment that element sits in.
 *
 * The element is handed back because a notice can hold several of them (see {@link PluginNoticeMode.Append}),
 * so whoever owns one message has to be able to update or remove exactly that message. The reference
 * stays valid once the fragment is handed to `Notice`: appending a fragment moves its children rather
 * than copying them.
 */
interface PluginNoticeComponentNoticeContent {
  /**
   * The element wrapping this message alone.
   */
  readonly contentEl: HTMLElement;

  /**
   * The fragment holding {@link PluginNoticeComponentNoticeContent.contentEl}, ready to hand to `Notice`
   * or to append into one.
   */
  readonly fragment: DocumentFragment;
}

/**
 * A message that has been put on screen, and where it ended up.
 */
interface PluginNoticeComponentShownNotice {
  /**
   * The element holding this message alone, inside {@link PluginNoticeComponentShownNotice.notice}.
   */
  readonly contentEl: HTMLElement;

  /**
   * Whether this message created the notice, as opposed to joining one that was already on screen.
   * Only the creator may hide it; a joined message can merely remove itself.
   */
  readonly isNoticeOwned: boolean;

  /**
   * The notice the message is in.
   */
  readonly notice: Notice;
}

interface PluginNoticeComponentShowNoticeWithDurationParams {
  readonly durationInMilliseconds: null | number;
  readonly message: DocumentFragment | string;
  readonly mode: PluginNoticeMode;
  readonly onCloseClick: ((this: void, event: PluginNoticeCloseClickEvent) => Promisable<void>) | undefined;
  readonly onHide: ((this: void, info: PluginNoticeHideInfo) => Promisable<void>) | undefined;
  readonly requiresExplicitClose: boolean;
  readonly shouldRegisterAsPermanent: boolean;
  readonly shouldShowCloseButton: boolean;
}

/**
 * Manages showing plugin notices. By default a new notice hides the previous one, so only the latest
 * message is on screen; {@link PluginNoticeComponentShowNoticeOptions.mode} chooses otherwise — see
 * {@link PluginNoticeMode}.
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
    for (const cancelPendingTimer of snapshot(this.pendingTimerCancellations)) {
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
    const mode = options?.mode ?? (requiresExplicitClose ? PluginNoticeMode.Separate : PluginNoticeMode.Replace);

    if (options?.mode !== undefined && options.mode !== PluginNoticeMode.Separate && requiresExplicitClose) {
      throw new Error('A notice that does not hide on click must be shown in the separate mode.');
    }
    if (mode === PluginNoticeMode.Separate && isPermanent) {
      throw new Error('A permanent notice cannot be shown in the separate mode.');
    }

    const durationInMilliseconds = isPermanent || requiresExplicitClose ? PERMANENT_NOTICE_DURATION_IN_MILLISECONDS : null;
    return this.showNoticeWithDuration({
      durationInMilliseconds,
      message,
      mode,
      onCloseClick: options?.onCloseClick,
      onHide: options?.onHide,
      requiresExplicitClose,
      shouldRegisterAsPermanent: isPermanent,
      shouldShowCloseButton: options?.shouldShowCloseButton ?? true
    }).notice;
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
    const mode = params.mode ?? PluginNoticeMode.Replace;
    // Where this message ended up: a notice of its own, or a chunk inside one that was already up. It
    // Decides what `setContent` rewrites and what disposing takes away.
    let shown: null | PluginNoticeComponentShownNotice = null;
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
        // Resolving the content is asynchronous, and the operation the notice describes keeps running
        // While it happens — so `setContent` can land in between. It cannot rewrite a notice that does
        // Not exist yet, so resolve again whenever that happens: the notice must open with the message
        // The caller last asked for, not the one that was current when resolution started.
        let requestedContent: ValueProvider<DocumentFragment | string>;
        let resolvedContent: DocumentFragment | string;
        do {
          requestedContent = currentContent;
          resolvedContent = await resolveValue(requestedContent, {});
          // The handle may have been disposed while the content was being resolved; don't show a stale notice.
          if (isDisposed) {
            return;
          }
        } while (requestedContent !== currentContent);

        shown = this.showNoticeWithDuration({
          durationInMilliseconds: PERMANENT_NOTICE_DURATION_IN_MILLISECONDS,
          message: buildDelayedMessage(resolvedContent),
          mode,
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
        if (!shown) {
          return;
        }
        // Swaps THIS message's element for a freshly built one, rather than rewriting the whole notice:
        // When the handle joined a notice that was already up, the other messages in it are not its to
        // Overwrite. Rebuilding also re-applies the prefix, the interactive guard, and the Cancel button.
        const rebuilt = this.buildNoticeContent({
          message: buildDelayedMessage(content),
          shouldPrefixWithPluginName: shown.isNoticeOwned
        });
        shown.contentEl.replaceWith(rebuilt.fragment);
        shown = { ...shown, contentEl: rebuilt.contentEl };
      },
      [Symbol.dispose]: (): void => {
        isDisposed = true;
        cancelPendingTimer();
        if (!shown) {
          return;
        }
        // A notice this handle opened goes away with it; a notice it merely joined belongs to whoever
        // Opened it, so only this message is taken out of it.
        if (shown.isNoticeOwned) {
          shown.notice.hide();
          this.standaloneNotices.delete(shown.notice);
          if (this.notice === shown.notice) {
            this.notice = null;
          }
        } else {
          shown.contentEl.remove();
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
    closeButtonEl.addEventListener('click', ($event) => {
      $event.stopPropagation();
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
   * Adds a message to the notice currently in the per-plugin slot, so both messages stay on screen in a
   * single notice.
   *
   * The appended message carries no plugin-name prefix — the notice already opens with one, and
   * repeating it on every line reads as noise. It is wrapped like any other notice content, so a link or
   * button inside it still keeps the notice open when clicked.
   *
   * Appending restarts the notice's countdown ({@link Notice.setAutoHide}), so the new message gets a
   * full duration instead of inheriting what was left of the current one — a line appended a moment
   * before the notice expires would otherwise flash and vanish.
   *
   * @param params - The parameters.
   * @returns The {@link PluginNoticeComponentShownNotice} describing the joined notice, or `null` when
   * there is nothing on screen to append to — the slot is empty, or its notice has since been dismissed
   * — and the caller should show a new notice instead.
   */
  private appendToCurrentNotice(params: PluginNoticeComponentAppendToCurrentNoticeParams): null | PluginNoticeComponentShownNotice {
    const { durationInMilliseconds, message, onHide, shouldRegisterAsPermanent } = params;
    const currentNotice = this.notice;
    // `isShown` is the same check Obsidian's own `Notice.hide` makes before animating a notice away, so
    // It is exactly "still on screen": a notice that expired or was dismissed has been detached.
    if (!currentNotice?.containerEl.isShown()) {
      return null;
    }

    const { contentEl, fragment } = this.buildNoticeContent({ message, shouldPrefixWithPluginName: false });
    currentNotice.messageEl.append(fragment);
    // A `null` duration means "Obsidian's own default", which only the constructor applies — so restart
    // The countdown with that same default rather than leaving the current one running.
    currentNotice.setAutoHide(durationInMilliseconds ?? OBSIDIAN_DEFAULT_NOTICE_DURATION_IN_MILLISECONDS);
    this.wireOnHide(currentNotice, onHide);
    // Only ever registers, never clears: the notice being appended to may already be this plugin's
    // Permanent notice, and a later appended message is no reason to forget that.
    if (shouldRegisterAsPermanent) {
      this.setPermanentNotice(currentNotice);
    }
    return { contentEl, isNoticeOwned: false, notice: currentNotice };
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
      fragment.append(content);
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
      fragment.append(cancelButton.buttonEl);
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
   * @returns The {@link PluginNoticeComponentNoticeContent} holding the wrapped notice content.
   */
  private buildNoticeContent(params: PluginNoticeComponentBuildNoticeContentParams): PluginNoticeComponentNoticeContent {
    const { getNotice, message, onCloseClick, requiresExplicitClose = false, shouldPrefixWithPluginName = true, shouldShowCloseButton = true } = params;
    const fragment = createFragment();
    const contentEl = fragment.createDiv();
    addPluginCssClasses(contentEl, CssClass.PluginNoticeContent);
    if (shouldPrefixWithPluginName) {
      contentEl.append(this.buildPrefixedMessage(message));
    } else if (typeof message === 'string') {
      contentEl.appendText(message);
    } else {
      contentEl.append(message);
    }
    contentEl.addEventListener('click', ($event) => {
      // A hard-to-close notice must not dismiss on any stray click; only its close button may hide it.
      if (requiresExplicitClose) {
        $event.stopPropagation();
        return;
      }
      if ($event.target instanceof Element && $event.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        $event.stopPropagation();
      }
    });

    if (requiresExplicitClose && shouldShowCloseButton) {
      this.appendCloseButton(normalizeOptionalProperties<PluginNoticeComponentAppendCloseButtonParams>({
        contentEl,
        getNotice: ensureNonNullable(getNotice),
        onCloseClick
      }));
    }
    return { contentEl, fragment };
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
    fragment.append(nameEl);
    if (!this._loaded) {
      fragment.appendText(' (unloaded)');
    }
    fragment.appendText('\n');
    if (typeof message === 'string') {
      fragment.appendText(message);
    } else {
      fragment.append(message);
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
    notice.containerEl.addEventListener('click', ($event) => {
      if ($event.target instanceof Element && $event.target.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        return;
      }
      $event.stopPropagation();
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
   * Shows a notice with the given duration, placing it according to its {@link PluginNoticeMode}: a
   * {@link PluginNoticeMode.Replace} notice takes the per-plugin slot (hiding whatever was in it, and
   * optionally registering as this plugin's permanent notice), an {@link PluginNoticeMode.Append} one
   * joins the notice already in the slot, and a {@link PluginNoticeMode.Separate} one is tracked on its
   * own, leaving the slot untouched.
   *
   * @param params - The parameters.
   * @returns The {@link PluginNoticeComponentShownNotice} describing where the message ended up.
   */
  private showNoticeWithDuration(params: PluginNoticeComponentShowNoticeWithDurationParams): PluginNoticeComponentShownNotice {
    const { durationInMilliseconds, message, mode, onCloseClick, onHide, requiresExplicitClose, shouldRegisterAsPermanent, shouldShowCloseButton } = params;
    // Obsidian's `Notice` treats an omitted duration as its default, so map the `null` "no explicit
    // Duration" value to `undefined`.
    const noticeDurationInMilliseconds = durationInMilliseconds ?? undefined;

    if (mode === PluginNoticeMode.Append) {
      const appendedNotice = this.appendToCurrentNotice(normalizeOptionalProperties<PluginNoticeComponentAppendToCurrentNoticeParams>({
        durationInMilliseconds,
        message,
        onHide,
        shouldRegisterAsPermanent
      }));
      if (appendedNotice) {
        return appendedNotice;
      }
      // Nothing on screen to append to, so this message becomes the slot's notice instead.
    }

    const hasCloseButton = requiresExplicitClose && shouldShowCloseButton;
    // The close button's click handler needs the `Notice`, which does not exist until it is built from
    // This content; capture it lazily via a holder resolved at click time. The getter is created only
    // When a close button is shown.
    let builtNotice: Notice | null = null;
    const { contentEl, fragment } = this.buildNoticeContent(normalizeOptionalProperties<PluginNoticeComponentBuildNoticeContentParams>({
      getNotice: hasCloseButton ? (): Notice | null => builtNotice : undefined,
      message,
      onCloseClick,
      requiresExplicitClose,
      shouldShowCloseButton
    }));

    if (mode === PluginNoticeMode.Separate) {
      builtNotice = new Notice(fragment, noticeDurationInMilliseconds);
      this.installExplicitCloseGuards(builtNotice, requiresExplicitClose);
      this.installUserClickTracking(builtNotice);
      this.wireOnHide(builtNotice, onHide);
      this.standaloneNotices.add(builtNotice);
      return { contentEl, isNoticeOwned: true, notice: builtNotice };
    }

    this.notice?.hide();
    builtNotice = new Notice(fragment, noticeDurationInMilliseconds);
    this.notice = builtNotice;
    this.installExplicitCloseGuards(builtNotice, requiresExplicitClose);
    this.installUserClickTracking(builtNotice);
    this.wireOnHide(builtNotice, onHide);

    if (shouldRegisterAsPermanent) {
      this.setPermanentNotice(builtNotice);
    } else {
      this.setPermanentNotice(null);
    }
    return { contentEl, isNoticeOwned: true, notice: builtNotice };
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
      $object: notice,
      methodName: 'hide',
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
