/**
 * @file
 *
 * Proves against a real Obsidian that the backlink index gives the answer Obsidian's own
 * `metadataCache.getBacklinksForFile` gives — for every file of a small vault with the link shapes the index has to
 * get right, for a path that does not exist, and again after a note's links change. The unit tests can only check
 * the index against a restated resolver; this checks it against the real one.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface Comparison {
  readonly indexed: string;
  readonly native: string;
  readonly path: string;
}

describe('getIndexedBacklinksForFile', () => {
  it('gives the same backlinks as Obsidian for every file, a missing path, and after an edit', async () => {
    const comparisons = await evalInObsidian<Record<string, never>, Comparison[]>({
      async callback({ app, lib: { getBacklinksForFileOrPath, getFile, getIndexedBacklinksForFile, registerFiles, waitUntil } }) {
        const ROOT = 'backlink-index-it';
        const files: Record<string, string> = {
          [`${ROOT}/image.png`]: '',
          [`${ROOT}/linker-a.md`]: '---\nup: "[[Target]]"\n---\n[[target]] [[sub/Target|alias]] ![[image.png]] [[Target#Heading]]\n',
          [`${ROOT}/linker-b.md`]: '[[backlink-index-it/sub/Target]] [[Missing Note]] [[linker-a.md]]\n',
          [`${ROOT}/sub/linker-c.md`]: '[[Target]] [[../linker-b]] [[image.png#x]]\n',
          [`${ROOT}/sub/Target.md`]: 'A second note with the same name.\n',
          [`${ROOT}/Target.md`]: 'Self link [[#Heading]]\n\n# Heading\n'
        };

        await app.vault.createFolder(`${ROOT}/sub`);
        for (const [path, content] of Object.entries(files)) {
          if (path.endsWith('.png')) {
            await app.vault.createBinary(path, new ArrayBuffer(0));
          } else {
            await app.vault.create(path, content);
          }
        }

        const markdownPaths = Object.keys(files).filter((path) => path.endsWith('.md'));
        const result: Comparison[] = [];

        try {
          await waitUntil({
            message: 'every created note should be in the metadata cache',
            predicate: isIndexed,
            timeoutInMilliseconds: 10_000
          });

          compareAll();

          const linkerB = app.vault.getFileByPath(`${ROOT}/linker-b.md`);
          if (!linkerB) {
            throw new Error('linker-b is gone.');
          }
          const hashBefore = app.metadataCache.fileCache[linkerB.path]?.hash;
          await app.vault.modify(linkerB, '[[Target]] and nothing else\n');
          await waitUntil({
            message: 'the edited note should be re-indexed',
            predicate: () => {
              const hash = app.metadataCache.fileCache[linkerB.path]?.hash;
              return hash !== hashBefore && hash !== undefined && app.metadataCache.metadataCache[hash] !== undefined;
            },
            timeoutInMilliseconds: 10_000
          });

          compareAll();
          return result;
        } finally {
          const folder = app.vault.getFolderByPath(ROOT);
          if (folder) {
            // eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- Permanent cleanup in tests.
            await app.vault.delete(folder, true);
          }
        }

        function isIndexed(): boolean {
          return markdownPaths.every((path) => app.metadataCache.getCache(path) !== null);
        }

        function snapshot(backlinks: ReturnType<typeof getIndexedBacklinksForFile>): string {
          return JSON.stringify(backlinks.keys().sort().map((key) => [key, backlinks.get(key)]));
        }

        function compareAll(): void {
          for (const path of Object.keys(files)) {
            const file = app.vault.getFileByPath(path);
            if (!file) {
              throw new Error(`No file at ${path}.`);
            }
            result.push({
              indexed: snapshot(getIndexedBacklinksForFile(app, file)),
              native: snapshot(app.metadataCache.getBacklinksForFile(file)),
              path
            });
          }

          const missingPath = `${ROOT}/Missing Note.md`;
          const indexed = snapshot(getBacklinksForFileOrPath(app, missingPath));
          if (app.vault.getAbstractFileByPath(missingPath)) {
            throw new Error(`${missingPath} must not exist.`);
          }
          const probe = getFile({ app, pathOrFile: missingPath, shouldIncludeNonExisting: true });
          const registration = registerFiles(app, [probe]);
          let native: string;
          try {
            native = snapshot(app.metadataCache.getBacklinksForFile(probe));
          } finally {
            registration[Symbol.dispose]();
          }
          result.push({ indexed, native, path: missingPath });
        }
      }
    });

    expect(comparisons.length).toBeGreaterThan(0);
    for (const { indexed, native, path } of comparisons) {
      expect(indexed, path).toBe(native);
    }
    // The comparison must not be vacuous: a frontmatter link, the self link, and the missing path's link all resolve.
    expect(comparisons.some(({ native }) => native.includes('"key":"up"'))).toBe(true);
    expect(comparisons.some(({ native, path }) => path.endsWith('/Target.md') && native.includes('#Heading'))).toBe(true);
    expect(comparisons.some(({ native, path }) => path.endsWith('Missing Note.md') && native.includes('linker-b.md'))).toBe(true);
  });
});
