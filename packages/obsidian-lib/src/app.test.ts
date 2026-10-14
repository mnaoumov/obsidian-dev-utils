import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  // eslint-disable-next-line import-x/no-deprecated -- Testing `getApp()`.
  getApp
} from './app.ts';

interface GlobalThisWithApp {
  app: unknown;
}

describe('getApp', () => {
  afterEach(() => {
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    delete (globalThis as Partial<GlobalThisWithApp>).app;
  });

  it('should return globalThis.app when it exists', () => {
    const mockApp = { vault: {} };
    // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
    (globalThis as Partial<GlobalThisWithApp>).app = mockApp;
    // eslint-disable-next-line @typescript-eslint/no-deprecated, import-x/no-deprecated -- Testing `getApp()`.
    expect(getApp()).toBe(mockApp);
  });

  it('should throw when no global app exists and require fails', () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated, import-x/no-deprecated -- Testing `getApp()`.
    expect(() => getApp()).toThrow('Obsidian App global instance not found');
  });
});
