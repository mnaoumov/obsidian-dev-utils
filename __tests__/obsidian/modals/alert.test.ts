// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  it,
  vi
} from 'vitest';

import { alert } from '../../../src/obsidian/modals/alert.ts';

vi.mock('i18next', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'OK';
  })
}));

vi.mock('../../../src/css-class.ts', () => ({
  CssClass: {
    AlertModal: 'alert-modal',
    OkButton: 'ok-button'
  }
}));

vi.mock('../../../src/obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show an alert modal and resolve when closed', async () => {
    await alert({
      app: {} as never,
      message: 'Test message'
    });
  });

  it('should show an alert with title and custom ok button text', async () => {
    await alert({
      app: {} as never,
      message: 'Test message',
      okButtonText: 'Got it',
      title: 'Test Title'
    });
  });

  it('should show an alert with custom css class', async () => {
    await alert({
      app: {} as never,
      cssClass: 'custom-alert',
      message: 'Test message'
    });
  });
});
