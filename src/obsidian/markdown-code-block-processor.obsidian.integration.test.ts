/**
 * @file
 *
 * Integration tests for the code block processor utilities.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

describe('markdown-code-block-processor', () => {
  it('should export getCodeBlockMarkdownInfo function', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return typeof lib.obsidian['markdown-code-block-processor'].getCodeBlockMarkdownInfo === 'function';
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });

  it('should export replaceCodeBlock function', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return typeof lib.obsidian['markdown-code-block-processor'].replaceCodeBlock === 'function';
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });

  it('should export insertAfterCodeBlock function', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return typeof lib.obsidian['markdown-code-block-processor'].insertAfterCodeBlock === 'function';
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });

  it('should export removeCodeBlock function', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return typeof lib.obsidian['markdown-code-block-processor'].removeCodeBlock === 'function';
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });

  it('should read note content with code block from vault', async () => {
    const result = await evalInObsidian<Record<string, never>, string>({
      async fn({ app }) {
        const content = [
          '# Test Note',
          '',
          '```js',
          'console.log("hello");',
          '```',
          ''
        ].join('\n');

        const file = await app.vault.create('code-block-test.md', content);
        try {
          return await app.vault.read(file);
        } finally {
          // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
          await app.vault.delete(file);
        }
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toContain('```js');
    expect(result).toContain('console.log("hello");');
  });
});
