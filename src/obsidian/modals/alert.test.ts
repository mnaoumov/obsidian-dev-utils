// @vitest-environment jsdom

import type { App as AppOriginal } from 'obsidian';

import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  it,
  vi
} from 'vitest';

import { alert } from './alert.ts';

let app: AppOriginal;

beforeEach(() => {
  app = App.createConfigured__().asOriginalType__();
});

vi.mock('i18next', () => ({
  t: vi.fn((selector: unknown) => {
    if (typeof selector === 'function') {
      const proxy: unknown = new Proxy({}, { get: (): unknown => proxy });
      (selector as (root: unknown) => unknown)(proxy);
    }
    return 'OK';
  })
}));

vi.mock('../../css-class.ts', () => ({
  CssClass: {
    AlertModal: 'alert-modal',
    OkButton: 'ok-button'
  }
}));

vi.mock('../../obsidian/plugin/plugin-context.ts', () => ({
  addPluginCssClasses: vi.fn()
}));

describe('alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show an alert modal and resolve when closed', async () => {
    await alert({
      app,
      message: 'Test message'
    });
  });

  it('should show an alert with title and custom ok button text', async () => {
    await alert({
      app,
      message: 'Test message',
      okButtonText: 'Got it',
      title: 'Test Title'
    });
  });

  it('should show an alert with custom css class', async () => {
    await alert({
      app,
      cssClasses: ['custom-alert'],
      message: 'Test message'
    });
  });
});
