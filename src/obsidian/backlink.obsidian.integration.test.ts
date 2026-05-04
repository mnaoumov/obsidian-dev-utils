/**
 * @file
 *
 * Integration tests for backlink-related functionality.
 * Tests the underlying metadata cache backlinks mechanism used by `backlink.ts`.
 * The full `renderBacklinksTable` requires Dataview, so we test the backlinks
 * retrieval layer directly.
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

/**
 * Result of the backlinks test.
 */
interface BacklinksResult {
  backlinkCount: number;
  backlinkKeys: string[];
}

let tempVault: TempVault;

beforeEach(async () => {
  tempVault = new TempVault();
  tempVault.populate({
    'linker-a.md': '# Linker A\n\nThis links to [[target]].\n',
    'linker-b.md': '# Linker B\n\nAlso links to [[target]] and [[other]].\n',
    'other.md': '# Other\n\nSome content.\n',
    'target.md': '# Target\n\nThis is the target note.\n'
  });
  await tempVault.register();
});

afterEach(async () => {
  await tempVault.dispose();
});

describe('backlinks via metadata cache', () => {
  it('should find backlinks to a target note', async () => {
    const result = await evalInObsidian<Record<string, never>, BacklinksResult>({
      fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        return lib.obsidian.metadata_cache.getBacklinksForFileSafe(app, 'target.md').then((backlinks) => ({
          backlinkCount: backlinks.count(),
          backlinkKeys: backlinks.keys()
        }));
      },
      vaultPath: tempVault.path
    });

    expect(result.backlinkKeys).toContain('linker-a.md');
    expect(result.backlinkKeys).toContain('linker-b.md');
    expect(result.backlinkCount).toBeGreaterThanOrEqual(2);
  });

  it('should find backlinks to a note with fewer links', async () => {
    const result = await evalInObsidian<Record<string, never>, BacklinksResult>({
      fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        return lib.obsidian.metadata_cache.getBacklinksForFileSafe(app, 'other.md').then((backlinks) => ({
          backlinkCount: backlinks.count(),
          backlinkKeys: backlinks.keys()
        }));
      },
      vaultPath: tempVault.path
    });

    expect(result.backlinkKeys).toContain('linker-b.md');
    expect(result.backlinkKeys).not.toContain('linker-a.md');
  });

  it('should return empty backlinks for a note with no incoming links', async () => {
    const result = await evalInObsidian<Record<string, never>, BacklinksResult>({
      fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        return lib.obsidian.metadata_cache.getBacklinksForFileSafe(app, 'linker-a.md').then((backlinks) => ({
          backlinkCount: backlinks.count(),
          backlinkKeys: backlinks.keys()
        }));
      },
      vaultPath: tempVault.path
    });

    expect(result.backlinkKeys).toHaveLength(0);
    expect(result.backlinkCount).toBe(0);
  });

  it('should detect links in the metadata cache', async () => {
    const result = await evalInObsidian<Record<string, never>, string[]>({
      fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }

        const cache = app.metadataCache.getCache('linker-b.md');
        if (!cache) {
          return [];
        }

        const links = lib.obsidian.metadata_cache.getAllLinks(cache);
        return links.map((ref) => ref.link);
      },
      vaultPath: tempVault.path
    });

    expect(result).toContain('target');
    expect(result).toContain('other');
  });
});
