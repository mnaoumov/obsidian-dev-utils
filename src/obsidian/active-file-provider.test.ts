/**
 * @file
 *
 * Tests for {@link AppActiveFileProvider}.
 */

import type {
  App as AppOriginal,
  TFile as TFileOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { AppActiveFileProvider } from './active-file-provider.ts';

describe('AppActiveFileProvider', () => {
  it('should return the active file from workspace', () => {
    const mockFile = strictProxy<TFileOriginal>({ path: 'test.md' });
    const app = strictProxy<AppOriginal>({
      workspace: { getActiveFile: vi.fn(() => mockFile) }
    });

    const provider = new AppActiveFileProvider(app);
    expect(provider.getActiveFile()).toBe(mockFile);
  });

  it('should return null when no file is active', () => {
    const app = strictProxy<AppOriginal>({
      workspace: { getActiveFile: vi.fn(() => null) }
    });

    const provider = new AppActiveFileProvider(app);
    expect(provider.getActiveFile()).toBeNull();
  });
});
