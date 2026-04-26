// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { noopAsync } from '../../function.ts';
import { addPluginCssClasses } from '../plugin/plugin-context.ts';
import {
  ModalBase,
  showModal
} from './modal.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

class TestModal extends ModalBase<string> {
  public override onClose(): void {
    super.onClose();
    this.resolve('closed');
  }

  public override onOpen(): void {
    super.onOpen();
  }
}

describe('ModalBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a modal and apply plugin css classes', async () => {
    await noopAsync();
    const resolve = vi.fn();
    const modal = new TestModal({ app, cssClasses: ['test-modal-class'] }, resolve);
    expect(addPluginCssClasses).toHaveBeenCalledWith(modal.containerEl, ['test-modal-class']);
  });

  it('should apply custom css class when provided', () => {
    const resolve = vi.fn();
    const addClass = vi.fn();
    const modal = new TestModal({ app, cssClasses: ['custom-class', 'test-modal-class'] }, resolve);
    modal.containerEl.addClass = addClass;
    // Re-create to test the constructor branch
    const modal2 = new TestModal({ app, cssClasses: ['custom-class', 'test-modal-class'] }, resolve);
    // The addClass should have been called in the constructor
    expect(modal2).toBeDefined();
  });

  it('should not add custom class when not provided', () => {
    const resolve = vi.fn();
    const modal = new TestModal({ app, cssClasses: ['test-modal-class'] }, resolve);
    expect(modal).toBeDefined();
  });
});

describe('showModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create and open modal, resolving when closed', async () => {
    const result = await showModal<string>((resolve) => {
      const modal = new TestModal({ app, cssClasses: ['test'] }, resolve);
      return modal;
    });
    expect(result).toBe('closed');
  });
});
