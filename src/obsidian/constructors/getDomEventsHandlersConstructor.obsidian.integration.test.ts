/**
 * @file
 *
 * Integration tests for {@link getDomEventsHandlersConstructor}.
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

describe('getDomEventsHandlersConstructor', () => {
  it('should extract the constructor from a live Obsidian vault', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        const ctor = await lib.obsidian.constructors.getDomEventsHandlersConstructor.getDomEventsHandlersConstructor(app);
        return typeof ctor === 'function';
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });
});
