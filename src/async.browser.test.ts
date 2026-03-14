// @vitest-environment jsdom

import {
  describe,
  expect,
  it
} from 'vitest';

import { requestAnimationFrameAsync } from './async.ts';

describe('Async', () => {
  describe('requestAnimationFrameAsync', () => {
    it('should resolve on the next request animation frame', async () => {
      await expect(requestAnimationFrameAsync()).resolves.toBeUndefined();
    });
  });
});
