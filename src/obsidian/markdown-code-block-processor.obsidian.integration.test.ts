/**
 * @file
 *
 * Integration tests for the code block processor utilities.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import {
  evalInObsidian,
  TempVault
} from 'obsidian-integration-testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

let tempVault: TempVault;

beforeEach(async () => {
  tempVault = new TempVault();
  tempVault.populate({
    'code-block-note.md': [
      '# Test Note',
      '',
      '```js',
      'console.log("hello");',
      '```',
      '',
      'Some text after the code block.',
      ''
    ].join('\n')
  });
  await tempVault.register();
});

afterEach(async () => {
  await tempVault.dispose();
});

describe('markdown-code-block-processor', () => {
  it('should export getCodeBlockMarkdownInfo function', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn() {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return typeof lib.obsidian.markdown_code_block_processor.getCodeBlockMarkdownInfo === 'function';
      },
      vaultPath: tempVault.path
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
        return typeof lib.obsidian.markdown_code_block_processor.replaceCodeBlock === 'function';
      },
      vaultPath: tempVault.path
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
        return typeof lib.obsidian.markdown_code_block_processor.insertAfterCodeBlock === 'function';
      },
      vaultPath: tempVault.path
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
        return typeof lib.obsidian.markdown_code_block_processor.removeCodeBlock === 'function';
      },
      vaultPath: tempVault.path
    });

    expect(result).toBe(true);
  });

  it('should read note content with code block from vault', async () => {
    const result = await evalInObsidian<Record<string, never>, string>({
      fn({ app }) {
        const file = app.vault.getAbstractFileByPath('code-block-note.md');
        if (!file) {
          throw new Error('code-block-note.md not found');
        }
        return app.vault.read(file as import('obsidian').TFile);
      },
      vaultPath: tempVault.path
    });

    expect(result).toContain('```js');
    expect(result).toContain('console.log("hello");');
  });
});
