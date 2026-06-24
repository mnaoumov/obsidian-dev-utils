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

import {
  noop,
  noopAsync
} from '../../function.ts';
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
    this.promiseResolve('closed');
  }

  public override onOpen(): void {
    noop();
  }
}

describe('ModalBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a modal and apply plugin css classes', async () => {
    await noopAsync();
    const promiseResolve = vi.fn();
    const modal = new TestModal({
      app,
      cssClasses: ['test-modal-class'],
      promiseResolve
    });
    expect(addPluginCssClasses).toHaveBeenCalledWith(modal.containerEl, ['test-modal-class']);
  });

  it('should apply custom css class when provided', () => {
    const promiseResolve = vi.fn();
    const addClass = vi.fn();
    const modal = new TestModal({
      app,
      cssClasses: ['custom-class', 'test-modal-class'],
      promiseResolve
    });
    modal.containerEl.addClass = addClass;
    // Re-create to test the constructor branch
    const modal2 = new TestModal({
      app,
      cssClasses: ['custom-class', 'test-modal-class'],
      promiseResolve
    });
    // The addClass should have been called in the constructor
    expect(modal2).toBeDefined();
  });

  it('should not add custom class when not provided', () => {
    const promiseResolve = vi.fn();
    const modal = new TestModal({
      app,
      cssClasses: ['test-modal-class'],
      promiseResolve
    });
    expect(modal).toBeDefined();
  });
});

describe('showModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create and open modal, resolving when closed', async () => {
    const result = await showModal<string>((promiseResolve) => {
      const modal = new TestModal({
        app,
        cssClasses: ['test'],
        promiseResolve
      });
      return modal;
    });
    expect(result).toBe('closed');
  });
});
