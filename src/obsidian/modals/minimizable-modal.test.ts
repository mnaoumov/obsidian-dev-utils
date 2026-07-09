// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { Modal } from 'obsidian';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../../type-guards.ts';
import { CssClass } from '../css-class.ts';
import { MinimizableModal } from './minimizable-modal.ts';

class OpenTrackingModal extends Modal {
  public wasOpened = false;

  public override onOpen(): void {
    this.wasOpened = true;
  }
}

class TrackingModal extends Modal {
  public wasClosed = false;

  public override onClose(): void {
    this.wasClosed = true;
  }
}

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

afterEach(() => {
  activeDocument.body.empty();
});

function getBar(): HTMLElement | null {
  return activeDocument.body.querySelector<HTMLElement>(`.${CssClass.MinimizedModalBar}`);
}

function getMinimizeButton(modal: Modal): HTMLElement {
  const buttonEl = modal.modalEl.querySelector<HTMLElement>(`.${CssClass.MinimizeButton}`);
  assertNonNullable(buttonEl);
  return buttonEl;
}

describe('MinimizableModal', () => {
  describe('setup', () => {
    it('should expose the wrapped modal', () => {
      const modal = new Modal(app);
      const minimizable = new MinimizableModal(modal);
      expect(minimizable.modal).toBe(modal);
    });

    it('should apply the minimizable-modal css class', () => {
      const modal = new Modal(app);
      new MinimizableModal(modal);
      expect(modal.containerEl.hasClass(CssClass.MinimizableModal)).toBe(true);
    });

    it('should add a minimize button', () => {
      const modal = new Modal(app);
      new MinimizableModal(modal);
      expect(modal.modalEl.querySelector(`.${CssClass.MinimizeButton}`)).not.toBeNull();
    });

    it('should not be minimized initially', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      expect(minimizable.isMinimized).toBe(false);
    });
  });

  describe('minimize', () => {
    it('should hide the modal and show a bar with the title and a restore button', () => {
      const modal = new Modal(app);
      modal.setTitle('Working');
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();

      expect(minimizable.isMinimized).toBe(true);
      expect(modal.containerEl.style.display).toBe('none');
      expect(getMinimizeButton(modal).style.display).toBe('none');

      const bar = getBar();
      assertNonNullable(bar);
      expect(bar.querySelector(`.${CssClass.MinimizedModalBarTitle}`)?.textContent).toBe('Working');
      expect(bar.querySelector(`.${CssClass.RestoreButton}`)).not.toBeNull();
    });

    it('should be a no-op when already minimized', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();
      minimizable.minimize();

      expect(activeDocument.body.querySelectorAll(`.${CssClass.MinimizedModalBar}`)).toHaveLength(1);
    });

    it('should minimize when the minimize button is clicked', () => {
      const modal = new Modal(app);
      const minimizable = new MinimizableModal(modal);
      getMinimizeButton(modal).click();

      expect(minimizable.isMinimized).toBe(true);
      expect(getBar()).not.toBeNull();
    });

    it('should pop the modal scope on minimize so mouse inspection is not fought by the focus trap', () => {
      const modal = new Modal(app);
      const popScopeSpy = vi.spyOn(app.keymap, 'popScope');
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();

      expect(popScopeSpy).toHaveBeenCalledWith(modal.scope);
    });
  });

  describe('restore', () => {
    it('should remove the bar and show the modal and minimize button', () => {
      const modal = new Modal(app);
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();
      minimizable.restore();

      expect(minimizable.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
      expect(modal.containerEl.style.display).toBe('');
      expect(getMinimizeButton(modal).style.display).toBe('');
    });

    it('should be a no-op when not minimized', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.restore();

      expect(minimizable.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });

    it('should push the modal scope back when restored so the modal blocks the app again', () => {
      const modal = new Modal(app);
      const pushScopeSpy = vi.spyOn(app.keymap, 'pushScope');
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();
      minimizable.restore();

      expect(pushScopeSpy).toHaveBeenCalledWith(modal.scope);
    });

    it('should restore when the restore button is clicked', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const bar = getBar();
      assertNonNullable(bar);
      const restoreButtonEl = bar.querySelector<HTMLElement>(`.${CssClass.RestoreButton}`);
      assertNonNullable(restoreButtonEl);
      restoreButtonEl.click();

      expect(minimizable.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });

    it('should restore when the bar itself is clicked', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const bar = getBar();
      assertNonNullable(bar);
      bar.click();

      expect(minimizable.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });

    it('should restore when the bar title is clicked', () => {
      const modal = new Modal(app);
      modal.setTitle('Working');
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();

      const bar = getBar();
      assertNonNullable(bar);
      const titleEl = bar.querySelector<HTMLElement>(`.${CssClass.MinimizedModalBarTitle}`);
      assertNonNullable(titleEl);
      titleEl.click();

      expect(minimizable.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });
  });

  describe('close', () => {
    it('should remove the minimized bar and reset state when the modal closes', () => {
      const modal = new Modal(app);
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();
      modal.onClose();

      expect(getBar()).toBeNull();
      expect(minimizable.isMinimized).toBe(false);
    });

    it('should not throw when the modal closes while not minimized', () => {
      const modal = new Modal(app);
      new MinimizableModal(modal);
      modal.onClose();
      expect(getBar()).toBeNull();
    });

    it('should still run the wrapped modal original onClose', () => {
      const modal = new TrackingModal(app);
      const minimizable = new MinimizableModal(modal);
      minimizable.minimize();
      modal.onClose();

      expect(modal.wasClosed).toBe(true);
      expect(getBar()).toBeNull();
    });
  });

  describe('content', () => {
    it('should render arbitrary content into contentEl', () => {
      const modal = new Modal(app);
      modal.contentEl.createEl('a', { text: 'Note link' });
      expect(modal.contentEl.querySelector('a')?.textContent).toBe('Note link');
    });
  });

  describe('peek-only lock', () => {
    it('should block opening another modal while minimized', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const other = new OpenTrackingModal(app);
      other.open();
      expect(other.wasOpened).toBe(false);

      minimizable.restore();
    });

    it('should not block the minimized modal itself from opening', () => {
      const inner = new OpenTrackingModal(app);
      const minimizable = new MinimizableModal(inner);
      minimizable.minimize();

      inner.open();
      expect(inner.wasOpened).toBe(true);

      minimizable.restore();
    });

    it('should allow opening modals again after restore', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();
      minimizable.restore();

      const other = new OpenTrackingModal(app);
      other.open();
      expect(other.wasOpened).toBe(true);
    });

    it('should self-heal a stale lock whose bar left the DOM without restore or close', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();
      // Simulate a teardown that removes the bar without going through restore()/close().
      getBar()?.remove();

      const other = new OpenTrackingModal(app);
      other.open();
      expect(other.wasOpened).toBe(true);
    });

    it('should block a command-key keydown while minimized and allow it again after restore', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const blockedEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'p' });
      activeDocument.body.dispatchEvent(blockedEvent);
      expect(blockedEvent.defaultPrevented).toBe(true);

      minimizable.restore();

      const allowedEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'p' });
      activeDocument.body.dispatchEvent(allowedEvent);
      expect(allowedEvent.defaultPrevented).toBe(false);
    });

    it('should let navigation keys through while minimized so the user can still inspect content', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
      for (const key of navigationKeys) {
        const navEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key });
        activeDocument.body.dispatchEvent(navEvent);
        expect(navEvent.defaultPrevented, `${key} should not be blocked`).toBe(false);
      }

      // Ctrl + a navigation key is still navigation (e.g. Ctrl+Home) and must pass through.
      const ctrlNavEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'Home' });
      activeDocument.body.dispatchEvent(ctrlNavEvent);
      expect(ctrlNavEvent.defaultPrevented).toBe(false);

      // A bare modifier press does nothing on its own, so it must not be blocked (no spurious beep).
      const shiftEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Shift' });
      activeDocument.body.dispatchEvent(shiftEvent);
      expect(shiftEvent.defaultPrevented).toBe(false);

      minimizable.restore();
    });

    it('should block Shift+navigation (text selection) while minimized', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const shiftArrowEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown', shiftKey: true });
      activeDocument.body.dispatchEvent(shiftArrowEvent);
      expect(shiftArrowEvent.defaultPrevented).toBe(true);

      minimizable.restore();
    });

    it('should block editor text input (beforeinput) while minimized', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const blockedEvent = new InputEvent('beforeinput', { bubbles: true, cancelable: true });
      activeDocument.body.dispatchEvent(blockedEvent);
      expect(blockedEvent.defaultPrevented).toBe(true);

      minimizable.restore();
    });

    it('should block the context menu while minimized and allow it again after restore', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();

      const blockedEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      activeDocument.body.dispatchEvent(blockedEvent);
      expect(blockedEvent.defaultPrevented).toBe(true);

      minimizable.restore();

      const allowedEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      activeDocument.body.dispatchEvent(allowedEvent);
      expect(allowedEvent.defaultPrevented).toBe(false);
    });

    it('should flash the bar on a blocked attempt and clear the flash when the animation ends', () => {
      const minimizable = new MinimizableModal(new Modal(app));
      minimizable.minimize();
      const bar = getBar();
      assertNonNullable(bar);
      expect(bar.hasClass(CssClass.MinimizedModalBarAttention)).toBe(false);

      activeDocument.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));
      expect(bar.hasClass(CssClass.MinimizedModalBarAttention)).toBe(true);

      bar.dispatchEvent(new Event('animationend'));
      expect(bar.hasClass(CssClass.MinimizedModalBarAttention)).toBe(false);

      minimizable.restore();
    });
  });
});
