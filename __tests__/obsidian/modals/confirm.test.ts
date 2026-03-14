// @vitest-environment jsdom

import { ButtonComponent } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { confirm } from '../../../src/obsidian/modals/confirm.ts';
import { mockImplementation } from '../../test-helpers.ts';

vi.mock('../../../src/css-class.ts', () => ({
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

vi.mock('../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('confirm', () => {
  const buttonInstances: ButtonComponent[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    buttonInstances.length = 0;
    // @ts-expect-error -- constructor2__ is a mock-only hook from obsidian-test-mocks.
    mockImplementation(
      ButtonComponent.prototype,
      'constructor2__',
      function captureButton(this: ButtonComponent, originalImplementation, containerEl: HTMLElement) {
        originalImplementation.call(this, containerEl);
        buttonInstances.push(this);
      }
    );
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
      const okButton = buttonInstances[0];
      okButton?.simulateClick__();
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
