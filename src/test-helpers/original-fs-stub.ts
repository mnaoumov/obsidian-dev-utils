/**
 * @file
 *
 * Test stub for Electron's `node:original-fs` module, which is unavailable under a plain Node/Vite
 * test runner. The demo-vault opener loads it at runtime via `window.require('node:original-fs')`; the
 * opener test stubs that global to return this `chmodSync`. Its `chmodSync` is a distinct reference (not
 * `node:fs`'s), letting the opener test assert that adm-zip was handed `original-fs` rather than the
 * asar-intercepted `node:fs`.
 */

import { noop } from '../function.ts';

/**
 * Stand-in for `original-fs.chmodSync`. A no-op with an identity distinct from `node:fs.chmodSync`.
 */
export const chmodSync: (path: string, mode: number) => void = noop;
