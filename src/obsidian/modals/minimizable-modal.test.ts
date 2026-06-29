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

import { CssClass } from '../../css-class.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { MinimizableModal } from './minimizable-modal.ts';

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

    it('should pop the modal scope so the app stays usable while minimized', () => {
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
});
