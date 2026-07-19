/**
 * @file
 *
 * Typings for Electron's `original-fs` module — the real `fs` with asar interception disabled.
 * Electron exposes it at runtime but ships no type declarations, so it is declared here as having
 * the same shape as `node:fs`. Used by the demo-vault opener to extract archives that contain
 * `.asar` files without Electron's asar layer crashing on `chmod`.
 *
 * @see {@link https://www.electronjs.org/docs/latest/tutorial/asar-archives#treating-an-asar-archive-as-a-normal-file} for more information.
 */

declare module 'node:original-fs' {
  export * from 'node:fs';
}
