// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { CssClass } from '../../css-class.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { MinimizableModal } from './minimizable-modal.ts';

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

function getMinimizeButton(modal: MinimizableModal): HTMLElement {
  const buttonEl = modal.modalEl.querySelector<HTMLElement>(`.${CssClass.MinimizeButton}`);
  assertNonNullable(buttonEl);
  return buttonEl;
}

describe('MinimizableModal', () => {
  describe('constructor', () => {
    it('should apply the minimizable-modal css class and any custom classes', () => {
      const modal = new MinimizableModal({
        app,
        cssClasses: ['custom-class']
      });
      expect(modal.containerEl.hasClass(CssClass.MinimizableModal)).toBe(true);
      expect(modal.containerEl.hasClass('custom-class')).toBe(true);
    });

    it('should set the title when provided', () => {
      const modal = new MinimizableModal({
        app,
        title: 'My title'
      });
      expect(modal.titleEl.textContent).toBe('My title');
    });

    it('should leave the title empty when not provided', () => {
      const modal = new MinimizableModal({ app });
      expect(modal.titleEl.textContent).toBe('');
    });

    it('should add a minimize button', () => {
      const modal = new MinimizableModal({ app });
      expect(modal.modalEl.querySelector(`.${CssClass.MinimizeButton}`)).not.toBeNull();
    });

    it('should not be minimized initially', () => {
      const modal = new MinimizableModal({ app });
      expect(modal.isMinimized).toBe(false);
    });
  });

  describe('minimize', () => {
    it('should hide the modal and show a bar with the title and a restore button', () => {
      const modal = new MinimizableModal({
        app,
        title: 'Working'
      });
      modal.minimize();

      expect(modal.isMinimized).toBe(true);
      expect(modal.containerEl.style.display).toBe('none');

      const bar = getBar();
      assertNonNullable(bar);
      expect(bar.querySelector(`.${CssClass.MinimizedModalBarTitle}`)?.textContent).toBe('Working');
      expect(bar.querySelector(`.${CssClass.RestoreButton}`)).not.toBeNull();
    });

    it('should be a no-op when already minimized', () => {
      const modal = new MinimizableModal({ app });
      modal.minimize();
      modal.minimize();

      expect(activeDocument.body.querySelectorAll(`.${CssClass.MinimizedModalBar}`)).toHaveLength(1);
    });

    it('should minimize when the minimize button is clicked', () => {
      const modal = new MinimizableModal({ app });
      getMinimizeButton(modal).click();

      expect(modal.isMinimized).toBe(true);
      expect(getBar()).not.toBeNull();
    });
  });

  describe('restore', () => {
    it('should remove the bar and show the modal', () => {
      const modal = new MinimizableModal({ app });
      modal.minimize();
      modal.restore();

      expect(modal.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
      expect(modal.containerEl.style.display).toBe('');
    });

    it('should be a no-op when not minimized', () => {
      const modal = new MinimizableModal({ app });
      modal.restore();

      expect(modal.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });

    it('should restore when the restore button is clicked', () => {
      const modal = new MinimizableModal({ app });
      modal.minimize();

      const bar = getBar();
      assertNonNullable(bar);
      const restoreButtonEl = bar.querySelector<HTMLElement>(`.${CssClass.RestoreButton}`);
      assertNonNullable(restoreButtonEl);
      restoreButtonEl.click();

      expect(modal.isMinimized).toBe(false);
      expect(getBar()).toBeNull();
    });
  });

  describe('onClose', () => {
    it('should remove the minimized bar and reset the minimized state', () => {
      const modal = new MinimizableModal({ app });
      modal.minimize();
      modal.onClose();

      expect(getBar()).toBeNull();
      expect(modal.isMinimized).toBe(false);
    });

    it('should not throw when closed while not minimized', () => {
      const modal = new MinimizableModal({ app });
      modal.onClose();
      expect(getBar()).toBeNull();
    });
  });

  describe('content', () => {
    it('should render arbitrary content into contentEl', () => {
      const modal = new MinimizableModal({ app });
      modal.contentEl.createEl('a', { text: 'Note link' });
      expect(modal.contentEl.querySelector('a')?.textContent).toBe('Note link');
    });
  });
});
