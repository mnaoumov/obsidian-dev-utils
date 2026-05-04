/**
 * @file
 *
 * Integration tests for backlink-related functionality.
 * Tests the underlying metadata cache backlinks mechanism used by `backlink.ts`.
 * The full `renderBacklinksTable` requires Dataview, so we test the backlinks
 * retrieval layer directly.
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
 * Result of the backlinks test.
 */
interface BacklinksResult {
  backlinkCount: number;
  backlinkKeys: string[];
}

describe('backlinks via metadata cache', () => {
  it('should find backlinks to a target note', async () => {
    const result = await evalInObsidian<Record<string, never>, BacklinksResult>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        await app.vault.create('backlink-target.md', '# Target\n\nThis is the target note.\n');
        await app.vault.create('backlink-linker-a.md', '# Linker A\n\nLinks to [[backlink-target]].\n');
        await app.vault.create('backlink-linker-b.md', '# Linker B\n\nAlso links to [[backlink-target]].\n');

        await new Promise((resolve) => {
          window.setTimeout(resolve, 1000);
        });

        try {
          const backlinks = await lib.obsidian.metadata_cache.getBacklinksForFileSafe(app, 'backlink-target.md');
          return {
            backlinkCount: backlinks.count(),
            backlinkKeys: backlinks.keys()
          };
        } finally {
          for (const path of ['backlink-target.md', 'backlink-linker-a.md', 'backlink-linker-b.md']) {
            const f = app.vault.getAbstractFileByPath(path);
            if (f) {
              // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
              await app.vault.delete(f);
            }
          }
        }
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result.backlinkKeys).toContain('backlink-linker-a.md');
    expect(result.backlinkKeys).toContain('backlink-linker-b.md');
    expect(result.backlinkCount).toBeGreaterThanOrEqual(2);
  });

  it('should return empty backlinks for a note with no incoming links', async () => {
    const result = await evalInObsidian<Record<string, never>, BacklinksResult>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        await app.vault.create('backlink-isolated.md', '# Isolated\n\nNo one links here.\n');

        await new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        });

        try {
          const backlinks = await lib.obsidian.metadata_cache.getBacklinksForFileSafe(app, 'backlink-isolated.md');
          return {
            backlinkCount: backlinks.count(),
            backlinkKeys: backlinks.keys()
          };
        } finally {
          const f = app.vault.getAbstractFileByPath('backlink-isolated.md');
          if (f) {
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(f);
          }
        }
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result.backlinkKeys).toHaveLength(0);
    expect(result.backlinkCount).toBe(0);
  });

  it('should detect links in the metadata cache', async () => {
    const result = await evalInObsidian<Record<string, never>, string[]>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        await app.vault.create('backlink-multi-linker.md', '# Multi\n\nLinks to [[alpha]] and [[beta]].\n');

        await new Promise((resolve) => {
          window.setTimeout(resolve, 500);
        });

        try {
          const cache = app.metadataCache.getCache('backlink-multi-linker.md');
          if (!cache) {
            return [];
          }
          const links = lib.obsidian.metadata_cache.getAllLinks(cache);
          return links.map((ref) => ref.link);
        } finally {
          const f = app.vault.getAbstractFileByPath('backlink-multi-linker.md');
          if (f) {
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(f);
          }
        }
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(result).toContain('alpha');
    expect(result).toContain('beta');
  });
});
