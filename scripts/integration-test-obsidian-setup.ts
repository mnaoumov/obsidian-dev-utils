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
 * The `lib` resolver comes from the PUBLISHED registration the `obsidian-dev-utils/integration-test-setup`
 * endpoint calls — the very code consumer plugins get — so this repo's own suites exercise the consumer path
 * rather than a private copy of it.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evalInObsidian } from 'obsidian-integration-testing';
import { beforeAll } from 'vitest';

import { registerIntegrationTestLibResolver } from '../src/script-utils/test-runners/integration-test-plugin.ts';

registerIntegrationTestLibResolver();

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
