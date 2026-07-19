/**
 * @file
 *
 * Test stub for Electron's `node:original-fs` module, which is unavailable under a plain Node/Vite
 * test runner. The `unit-tests:obsidian` Vitest project aliases `node:original-fs` to this file so the
 * demo-vault opener resolves during tests. Its `chmodSync` is a distinct reference (not `node:fs`'s),
 * letting the opener tests assert that adm-zip was handed `original-fs` rather than the asar-intercepted
 * `node:fs`.
 */

import { noop } from '../function.ts';

/**
 * Stand-in for `original-fs.chmodSync`. A no-op with an identity distinct from `node:fs.chmodSync`.
 */
export const chmodSync: (path: string, mode: number) => void = noop;
