import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ButtonComponent } from '../../../__mocks__/obsidian/ButtonComponent.ts';
import { confirm } from '../../../src/obsidian/Modals/Confirm.ts';

vi.mock('../../../src/CssClass.ts', () => ({
  CssClass: {
    CancelButton: 'cancel-button',
    ConfirmModal: 'confirm-modal',
    OkButton: 'ok-button'
  }
}));

vi.mock('../../../src/obsidian/i18n/i18n.ts', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'mock-translation';
  })
}));

vi.mock('../../../src/obsidian/Plugin/PluginContext.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ButtonComponent.instances = [];
  });

  it('should resolve false when modal is closed without confirming', async () => {
    const result = await confirm({
      app: {} as never,
      message: 'Are you sure?'
    });
    expect(result).toBe(false);
  });

  it('should resolve true when OK button is clicked', async () => {
    const resultPromise = confirm({
      app: {} as never,
      message: 'Continue?'
    });
    // OnOpen has run synchronously - buttons are created.
    // Simulate OK button click via microtask (runs before setTimeout auto-close).
    queueMicrotask(() => {
      const okButton = ButtonComponent.instances[0];
      okButton?.simulateClick();
    });
    const result = await resultPromise;
    expect(result).toBe(true);
  });

  it('should accept custom button texts and title', async () => {
    const result = await confirm({
      app: {} as never,
      cancelButtonText: 'No',
      message: 'Continue?',
      okButtonText: 'Yes',
      title: 'Confirm Action'
    });
    expect(typeof result).toBe('boolean');
  });

  it('should accept custom css class', async () => {
    const result = await confirm({
      app: {} as never,
      cssClass: 'custom-confirm',
      message: 'Continue?'
    });
    expect(typeof result).toBe('boolean');
  });
});
