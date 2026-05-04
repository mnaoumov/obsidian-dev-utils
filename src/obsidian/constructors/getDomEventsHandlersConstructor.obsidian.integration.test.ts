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

/**
 * Args for the repeated extraction test.
 */
type RepeatedExtractionArgs = {
  repeatCount: number;
} & Record<string, unknown>;

/**
 * Result of running the repeated extraction test.
 */
interface RepeatedExtractionResult {
  failedAttempts: number[];
  successCount: number;
  totalAttempts: number;
}

const REPEAT_COUNT = 20;

describe('getDomEventsHandlersConstructor', () => {
  it('should extract the constructor from a live Obsidian vault', async () => {
    const result = await evalInObsidian<Record<string, never>, boolean>({
      fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        return lib.obsidian.constructors.getDomEventsHandlersConstructor.getDomEventsHandlersConstructor(app)
          .then((ctor) => typeof ctor === 'function');
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toBe(true);
  });

  it(`should succeed consistently across ${String(REPEAT_COUNT)} sequential calls`, async () => {
    const results = await evalInObsidian<RepeatedExtractionArgs, RepeatedExtractionResult>({
      args: { repeatCount: REPEAT_COUNT },
      fn: async ({ app, repeatCount }) => {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        let successCount = 0;
        const failedAttempts: number[] = [];

        for (let i = 0; i < repeatCount; i++) {
          try {
            const ctor = await lib.obsidian.constructors.getDomEventsHandlersConstructor.getDomEventsHandlersConstructor(app);
            if (typeof ctor === 'function') {
              successCount++;
            } else {
              failedAttempts.push(i);
            }
          } catch {
            failedAttempts.push(i);
          }
        }

        return { failedAttempts, successCount, totalAttempts: repeatCount };
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(results.failedAttempts, `Failed at attempts: ${JSON.stringify(results.failedAttempts)}`).toEqual([]);
    expect(results.successCount).toBe(REPEAT_COUNT);
  });
});
