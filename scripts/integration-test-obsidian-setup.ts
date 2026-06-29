/**
 * @file
 *
 * Per-test setup file for the Obsidian integration tests.
 *
 * Injects the built library styles (`dist/styles.css`) into the shared Obsidian instance. In a real
 * plugin `initPluginContext` injects them, but the integration harness plugin only exposes the module
 * on `window`, so the styles must be injected here for tests that rely on the library's CSS. The
 * injection is idempotent (keyed by a style element id), so running it once per test file is safe.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evalInObsidian } from 'obsidian-integration-testing';
import { beforeAll } from 'vitest';

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
