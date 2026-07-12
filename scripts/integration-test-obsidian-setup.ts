/**
 * @file
 *
 * Per-test setup file for the Obsidian integration tests.
 *
 * Injects the built library styles (`dist/styles.css`) into the shared Obsidian instance. In a real
 * plugin `initPluginContext` injects them, but the integration harness plugin only exposes the module
 * on `window`, so the styles must be injected here for tests that rely on the library's CSS. The
 * injection is idempotent (keyed by a style element id), so running it once per test file is safe.
 *
 * Also registers the `lib` resolver: the harness merges the object it returns into the `lib` argument
 * of every `evalInObsidian` callback, so a serialized closure reaches any library helper as `lib.fn`
 * (the flat `__merged` barrel the integration harness plugin exposes on `window`).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  evalInObsidian,
  registerLibResolver
} from 'obsidian-integration-testing';
import { beforeAll } from 'vitest';

registerLibResolver(() => {
  const obsidianDevUtilsModule = window.__obsidianDevUtilsModule;
  if (!obsidianDevUtilsModule) {
    throw new Error('The obsidian-dev-utils module is not exposed on `window`. Is the integration harness plugin loaded?');
  }
  return obsidianDevUtilsModule.__merged;
});

const STYLES_CSS_PATH = join(import.meta.dirname, '../dist/styles.css');

beforeAll(async () => {
  const cssContent = await readFile(STYLES_CSS_PATH, 'utf-8');
  await evalInObsidian({
    args: { css: cssContent },
    fn({ css }) {
      const STYLES_ID = 'obsidian-dev-utils-styles';
      activeDocument.head.querySelector(`#${STYLES_ID}`)?.remove();
      activeDocument.head.createEl('style', {
        attr: { id: STYLES_ID },
        text: css
      });
    }
  });
});
