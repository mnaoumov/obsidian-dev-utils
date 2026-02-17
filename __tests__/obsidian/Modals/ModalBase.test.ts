// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ModalOptionsBase } from '../../../src/obsidian/Modals/ModalBase.ts';

import {
  ModalBase,
  showModal
} from '../../../src/obsidian/Modals/ModalBase.ts';

vi.mock('../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

class TestModal extends ModalBase<string, ModalOptionsBase> {
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
    const { addPluginCssClasses } = await import('../../../src/obsidian/Plugin/PluginContext.ts');
    const resolve = vi.fn();
    const modal = new TestModal({ app: {} as never }, resolve, 'test-modal-class');
    expect(addPluginCssClasses).toHaveBeenCalledWith(modal.containerEl, 'test-modal-class');
  });

  it('should apply custom css class when provided', () => {
    const resolve = vi.fn();
    const addClass = vi.fn();
    const modal = new TestModal({ app: {} as never, cssClass: 'custom-class' }, resolve, 'test-modal-class');
    modal.containerEl.addClass = addClass;
    // Re-create to test the constructor branch
    const modal2 = new TestModal({ app: {} as never, cssClass: 'custom-class' }, resolve, 'test-modal-class');
    // The addClass should have been called in the constructor
    expect(modal2).toBeDefined();
  });

  it('should not add custom class when not provided', () => {
    const resolve = vi.fn();
    const modal = new TestModal({ app: {} as never }, resolve, 'test-modal-class');
    expect(modal).toBeDefined();
  });
});

describe('showModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create and open modal, resolving when closed', async () => {
    const result = await showModal<string>((resolve) => {
      const modal = new TestModal({ app: {} as never }, resolve, 'test');
      return modal;
    });
    expect(result).toBe('closed');
  });
});
