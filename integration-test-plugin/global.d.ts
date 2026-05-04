/**
 * @file
 *
 * Global type augmentation for the integration test harness plugin.
 * Declares the strongly typed `__obsidianDevUtilsModule__` property on `Window`.
 */

// eslint-disable-next-line import-x/no-namespace -- Need entire module for typeof.
import type * as obsidianDevUtils from '../src/index.ts';

declare global {
  interface Window {
    __obsidianDevUtilsModule__?: typeof obsidianDevUtils;
  }
}
