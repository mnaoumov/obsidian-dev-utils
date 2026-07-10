/**
 * @file
 *
 * A wrapper that makes any Obsidian {@link Modal} minimizable to a floating bar — without breaking the
 * modal's blocking contract.
 *
 * Obsidian's {@link Modal} is blocking: while it is open the rest of the app is meant to be inert until
 * the modal is dismissed. {@link MinimizableModal} wraps any modal instance (plain `Modal`,
 * `FuzzySuggestModal`, the library's `ModalBase`, your own subclass, … — including modals you do not
 * own) and adds a minimize button. Minimizing hides the modal and its blocking backdrop and shows a
 * small floating bar with a restore button, so the user can peek at the notes/folders the operation
 * involves — but the modal is NOT dismissed, so its blocking contract must be preserved.
 *
 * To keep that contract while minimized, the wrapper puts the app into a **peek-only lock**: the user
 * may mouse-click and scroll to inspect content, but cannot start anything new. While any modal is
 * minimized the wrapper:
 * - blocks the keyboard (typing, hotkeys, the command-palette shortcut),
 * - blocks the right-click context menu, and
 * - blocks opening any other modal (a re-fired command, the command palette, settings, …).
 *
 * A blocked attempt flashes the floating bar and beeps so the user sees (and hears) why nothing
 * happened. Restoring (or the modal closing) lifts the lock. This prevents, for example, minimizing a
 * "merge folder" picker and then firing the same command again to stack several concurrent merges.
 *
 * The wrapper reuses the modal's own title (`titleEl`) as the minimized bar label, so set the title
 * the usual way (`modal.setTitle(...)`). Render arbitrary content into {@link Modal.contentEl},
 * including clickable note links produced by `renderInternalLink` from
 * `obsidian-dev-utils/obsidian/markdown`:
 *
 * ```ts
 * const modal = new MyModal(app);
 * modal.setTitle('Merging notes');
 * modal.contentEl.appendChild(await renderInternalLink({ app, pathOrAbstractFile: file }));
 *
 * const minimizable = new MinimizableModal(modal);
 * minimizable.modal.open();
 * minimizable.minimize(); // a floating bar offers "restore"; the app is peek-only until restored
 * ```
 *
 * The wrapped modal can still be closed normally; the floating bar is cleaned up automatically when
 * the modal closes (even if it is closed while minimized).
 */

import type { App } from 'obsidian';

import {
  Modal,
  setIcon
} from 'obsidian';

import { Beeper } from '../../beeper.ts';
import { AllWindowsEventComponent } from '../components/all-windows-event-component.ts';
import { MonkeyAroundComponent } from '../components/monkey-around-component.ts';
import { CssClass } from '../css-class.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';

const MINIMIZE_ICON_ID = 'minus';
const RESTORE_ICON_ID = 'maximize-2';

// Navigation keys pass through while minimized so the user can move the cursor and scroll to read.
// None of them mutate the document — text changes are caught separately by the `beforeinput` guard.
// Shift+navigation is blocked, though, since it extends the selection that inspection does not need.
const NAVIGATION_KEYS = new Set<string>([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp'
]);

// A bare modifier press does nothing on its own, so it passes through the lock.
// This avoids a spurious flash/beep while composing a shortcut; the shortcut's command key is blocked.
const MODIFIER_KEYS = new Set<string>([
  'Alt',
  'Control',
  'Meta',
  'Shift'
]);

/**
 * A registered entry for a currently-minimized modal. The shared peek-only lock uses it to know a
 * modal is minimized, to leave that modal's own re-opens alone, and to flash its bar on a blocked
 * attempt.
 */
interface PeekLockEntry {
  /**
   * The floating bar element. Used to detect a stale entry (its bar has left the DOM) so it can be
   * pruned and never keep the app locked.
   */
  readonly barEl: HTMLElement;

  /**
   * Flashes the floating bar to signal a blocked attempt.
   */
  flash(): void;

  /**
   * The wrapped modal instance, so its own `open()` is never blocked by the lock.
   */
  readonly innerModal: Modal;
}

const peekLockEntries = new Set<PeekLockEntry>();
const beeper = new Beeper();

/**
 * Installs the peek-only lock's `open` patches while at least one modal is minimized. Being a
 * {@link MonkeyAroundComponent}, both patches are torn down automatically on `unload`, so they exist
 * only while the lock is active. A minimized modal's own re-open is always allowed (see
 * {@link shouldBlockOpen}); every other modal open is blocked and signals a flash + beep.
 */
class PeekLockComponent extends MonkeyAroundComponent {
  /**
   * Constructs a new instance.
   *
   * @param app - The app whose settings modal is guarded and whose windows suppress input while locked.
   */
  public constructor(private readonly app: App) {
    super();
  }

  /**
   * Registers the `open` patches and the input suppressors.
   */
  public override onload(): void {
    super.onload();

    // Block opening any OTHER modal while a modal is minimized (the command palette, a re-fired
    // Command, another plugin modal, …).
    this.registerMethodPatch<Modal, 'open'>({
      methodName: 'open',
      obj: Modal.prototype,
      patchHandler: ({ fallback, originalThis }): void => {
        blockOrFallback(originalThis, fallback);
      }
    });

    // Obsidian's Settings is a *popout* modal: on desktop its own `open()` first creates a separate OS
    // Window (via `shouldUsePopout()`/`getPopoutOptions()`) and only THEN delegates to
    // `Modal.prototype.open` to render the active tab into it. Guarding only `Modal.prototype.open`
    // Therefore blocks the render but leaves an empty settings window behind — the reported bad UX.
    // Guarding the settings modal's own `open()` blocks it *before* the window is created.
    this.registerMethodPatch<App['setting'], 'open'>({
      methodName: 'open',
      obj: this.app.setting,
      patchHandler: ({ fallback, originalThis }): void => {
        blockOrFallback(originalThis, fallback);
      }
    });

    // Suppress the keyboard, editor mutation, and the context menu across ALL windows — the main window
    // And every existing/future popout — so the lock holds wherever the user's focus is, not only in
    // The window that owns the minimized modal. Capture-phase listeners run before Obsidian's own
    // Document/element handlers (including CodeMirror's), so `stopImmediatePropagation()` in the
    // Suppressors keeps a blocked event from ever reaching them. `keydown` lets navigation keys through
    // (see `isPeekAllowedKey`) but blocks command hotkeys; `beforeinput` blocks all editor mutation;
    // `contextmenu` blocks the right-click menu.
    const allWindowsEventComponent = this.addChild(new AllWindowsEventComponent(this.app));
    allWindowsEventComponent.registerAllWindowsDomEvent({
      callback: suppressKeydownWhilePeekLocked,
      options: { capture: true },
      type: 'keydown'
    });
    allWindowsEventComponent.registerAllWindowsDomEvent({
      callback: suppressWhilePeekLocked,
      options: { capture: true },
      type: 'beforeinput'
    });
    allWindowsEventComponent.registerAllWindowsDomEvent({
      callback: suppressWhilePeekLocked,
      options: { capture: true },
      type: 'contextmenu'
    });
  }
}

/**
 * Wraps a {@link Modal} instance to make it minimizable to a small floating bar and restorable. While
 * minimized the app is put into a peek-only lock (keyboard, context menu, and opening other modals are
 * blocked) so the modal's blocking contract is preserved.
 *
 * @typeParam TModal - The type of the wrapped modal.
 */
export class MinimizableModal<TModal extends Modal> {
  /**
   * The wrapped modal. Open, close, and populate it as usual (e.g. `minimizable.modal.open()`).
   */
  public readonly modal: TModal;

  /**
   * Whether the modal is currently minimized.
   *
   * @returns `true` if the modal is currently minimized, `false` otherwise.
   */
  public get isMinimized(): boolean {
    return this.isMinimizedValue;
  }

  /**
   * Patches the wrapped modal's `onClose` to run cleanup. Persists for the wrapper's whole life (a
   * modal can be reopened, so the patch must survive each close), hence a dedicated component that is
   * never unloaded — distinct from `peekLockComponent`, whose patches live only while minimized.
   * Exposed to subclasses so they can register additional lifetime-scoped patches on the wrapper.
   */
  protected readonly closePatchComponent = new MonkeyAroundComponent();

  private isMinimizedValue = false;
  private readonly minimizeButtonEl: HTMLElement;
  private minimizedBarEl: HTMLElement | null = null;
  private peekLockComponent: null | PeekLockComponent = null;
  private peekLockEntry: null | PeekLockEntry = null;

  /**
   * Wraps the given modal, adding a minimize button and wiring up cleanup on close.
   *
   * @param modal - The modal instance to make minimizable.
   */
  public constructor(modal: TModal) {
    this.modal = modal;
    addPluginCssClasses(modal.containerEl, [CssClass.MinimizableModal]);
    this.minimizeButtonEl = this.createMinimizeButton();
    this.closePatchComponent.load();
    this.patchOnClose(modal);
  }

  /**
   * Minimizes the modal: hides the modal and its backdrop, shows a floating bar with a restore button,
   * and puts the app into the peek-only lock. A no-op if the modal is already minimized.
   */
  public minimize(): void {
    if (this.isMinimizedValue) {
      return;
    }

    this.isMinimizedValue = true;
    this.minimizeButtonEl.hide();
    this.modal.containerEl.hide();
    // The modal stays open while minimized, so its keymap scope is popped to release the focus trap.
    // Restoring re-pushes it. An active trap would steal focus back to the hidden modal, blocking the
    // Mouse-driven inspection (clicking notes, scrolling) that minimize exists to allow.
    // Keyboard input remains blocked by the peek-only lock, so releasing the trap keeps the app inert.
    this.modal.app.keymap.popScope(this.modal.scope);
    this.minimizedBarEl = this.createMinimizedBar();
    this.enablePeekLock(this.minimizedBarEl);
  }

  /**
   * Restores the modal from the minimized state, removing the floating bar and lifting the peek-only
   * lock. A no-op if the modal is not minimized.
   */
  public restore(): void {
    if (!this.isMinimizedValue) {
      return;
    }

    this.isMinimizedValue = false;
    this.disablePeekLock();
    this.removeMinimizedBar();
    // Re-push the scope popped in minimize() so the restored modal blocks the app again (focus trap
    // + Escape capture).
    this.modal.app.keymap.pushScope(this.modal.scope);
    this.modal.containerEl.show();
    this.minimizeButtonEl.show();
  }

  private createMinimizeButton(): HTMLElement {
    const buttonEl = this.modal.modalEl.createEl('button', { cls: CssClass.MinimizeButton });
    setIcon(buttonEl, MINIMIZE_ICON_ID);
    buttonEl.addEventListener('click', () => {
      this.minimize();
    });
    return buttonEl;
  }

  private createMinimizedBar(): HTMLElement {
    const barEl = this.modal.containerEl.ownerDocument.body.createDiv();
    addPluginCssClasses(barEl, [CssClass.MinimizedModalBar]);
    barEl.createSpan({
      cls: CssClass.MinimizedModalBarTitle,
      text: this.modal.titleEl.textContent
    });
    const restoreButtonEl = barEl.createEl('button', { cls: CssClass.RestoreButton });
    setIcon(restoreButtonEl, RESTORE_ICON_ID);
    // The whole bar restores on click, not just the restore button — a larger, easier click target.
    // `restore()` guards against a double invocation, so the restore button's own click bubbling up
    // Here is a no-op. The restore button stays purely as a visual affordance for the click target.
    barEl.addEventListener('click', () => {
      this.restore();
    });
    // Drop the one-shot attention flash once it finishes so the bar returns to its gentle idle pulse.
    // The idle pulse is an infinite animation, which never fires `animationend`.
    barEl.addEventListener('animationend', () => {
      barEl.removeClass(CssClass.MinimizedModalBarAttention);
    });
    return barEl;
  }

  private disablePeekLock(): void {
    if (!this.peekLockEntry) {
      return;
    }

    peekLockEntries.delete(this.peekLockEntry);
    this.peekLockEntry = null;
    // Tear the `open` patches down with the component, so they exist only while this modal is minimized.
    this.peekLockComponent?.unload();
    this.peekLockComponent = null;
  }

  private enablePeekLock(barEl: HTMLElement): void {
    this.peekLockEntry = {
      barEl,
      flash: (): void => {
        this.flashBar(barEl);
      },
      innerModal: this.modal
    };
    peekLockEntries.add(this.peekLockEntry);
    // Install the `open` patches and input suppressors for as long as this modal is minimized. The
    // Block LOGIC itself keys off the shared `peekLockEntries` (see `shouldBlockOpen`), so with several
    // Modals minimized every one's patch reaches the same verdict; the lock lifts only once the last
    // Modal restores/closes.
    this.peekLockComponent = new PeekLockComponent(this.modal.app);
    this.peekLockComponent.load();
  }

  private flashBar(barEl: HTMLElement): void {
    barEl.removeClass(CssClass.MinimizedModalBarAttention);
    // Force a reflow so re-adding the class restarts the one-shot flash on rapid repeated blocks.
    barEl.getBoundingClientRect();
    barEl.addClass(CssClass.MinimizedModalBarAttention);
  }

  private handleClose(): void {
    this.disablePeekLock();
    this.removeMinimizedBar();
    this.isMinimizedValue = false;
  }

  private patchOnClose(modal: Modal): void {
    this.closePatchComponent.registerMethodPatch<Modal, 'onClose'>({
      methodName: 'onClose',
      obj: modal,
      patchHandler: ({ fallback }): void => {
        fallback();
        this.handleClose();
      }
    });
  }

  private removeMinimizedBar(): void {
    this.minimizedBarEl?.remove();
    this.minimizedBarEl = null;
  }
}

function blockEvent(evt: Event): void {
  evt.preventDefault();
  evt.stopImmediatePropagation();
  signalBlockedAttempt();
}

function blockOrFallback(modal: Modal, fallback: () => void): void {
  if (shouldBlockOpen(modal)) {
    signalBlockedAttempt();
    return;
  }

  fallback();
}

function flashMinimizedBars(): void {
  for (const entry of peekLockEntries) {
    entry.flash();
  }
}

function isMinimizedInnerModal(modal: Modal): boolean {
  for (const entry of peekLockEntries) {
    if (entry.innerModal === modal) {
      return true;
    }
  }

  return false;
}

function isPeekAllowedKey(evt: KeyboardEvent): boolean {
  // Navigation moves the cursor/scrolls (allowed), but Shift+navigation extends the selection (not
  // Needed for inspection), so it is blocked. Bare modifier presses pass through on their own.
  if (NAVIGATION_KEYS.has(evt.key)) {
    return !evt.shiftKey;
  }

  return MODIFIER_KEYS.has(evt.key);
}

function isPeekLocked(): boolean {
  // Drop entries whose bar has left the DOM without a restore() or close().
  // A test teardown that empties the body is the typical cause; this keeps a stale entry from locking.
  for (const entry of peekLockEntries) {
    if (!entry.barEl.isConnected) {
      peekLockEntries.delete(entry);
    }
  }

  return peekLockEntries.size > 0;
}

function shouldBlockOpen(modal: Modal): boolean {
  // A modal's own re-open is never blocked — otherwise a minimized modal could not restore/re-open
  // Itself. Every OTHER modal open is blocked while any modal is minimized (the peek-only lock).
  return isPeekLocked() && !isMinimizedInnerModal(modal);
}

function signalBlockedAttempt(): void {
  flashMinimizedBars();
  beeper.beep();
}

function suppressKeydownWhilePeekLocked(evt: KeyboardEvent): void {
  if (!isPeekLocked() || isPeekAllowedKey(evt)) {
    return;
  }

  blockEvent(evt);
}

function suppressWhilePeekLocked(evt: Event): void {
  if (!isPeekLocked()) {
    return;
  }

  blockEvent(evt);
}
