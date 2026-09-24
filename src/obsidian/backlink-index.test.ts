import type {
  App,
  CachedMetadata,
  Reference,
  ReferenceCache,
  TFile
} from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import { getIndexedBacklinksForFile } from './backlink-index.ts';

interface CallCounter {
  count: number;
}

interface FakeCanvasReference {
  readonly reference: Reference;
  readonly sourcePath: string;
}

interface FakeFileCacheEntry {
  readonly hash: string;
}

interface FakeVault {
  readonly app: App;
  readonly canvasReferences: FakeCanvasReference[];
  readonly files: Map<string, TFile>;
  readonly resolveCalls: CallCounter;
  setNote: (path: string, cache: CachedMetadata | undefined, hash?: string) => void;
}

let currentVault: FakeVault;

function createVault(): FakeVault {
  const files = new Map<string, TFile>();
  const fileCache: Record<string, FakeFileCacheEntry> = {};
  const metadataCacheByHash: Record<string, CachedMetadata> = {};
  const canvasReferences: FakeCanvasReference[] = [];
  const resolveCalls: CallCounter = { count: 0 };

  /*
   * A resolver with the one property the index relies on: it only ever returns a file whose lowercased name is
   * the lowercased last segment of the linkpath, or that segment plus `.md`, or the source itself for an empty
   * linkpath. A linkpath with a folder in it must match the path; a bare one takes the first file by name.
   */
  function getFirstLinkpathDestination(linkpath: string, sourcePath: string): null | TFile {
    resolveCalls.count++;
    if (linkpath === '') {
      return files.get(sourcePath) ?? null;
    }
    const lower = linkpath.toLowerCase();
    const segment = lower.slice(lower.lastIndexOf('/') + 1);
    for (const file of files.values()) {
      const name = file.name.toLowerCase();
      if (name !== segment && name !== `${segment}.md`) {
        continue;
      }
      if (!lower.includes('/')) {
        return file;
      }
      const path = file.path.toLowerCase();
      if (path === lower || path === `${lower}.md`) {
        return file;
      }
    }
    return null;
  }

  const app = castTo<App>({
    metadataCache: {
      fileCache,
      // eslint-disable-next-line unicorn/name-replacements -- Obsidian's own method name.
      getFirstLinkpathDest: getFirstLinkpathDestination,
      linkUpdaters: {
        canvas: {
          iterateReferences(callback: (sourcePath: string, reference: Reference) => void): void {
            for (const { reference, sourcePath } of canvasReferences) {
              callback(sourcePath, reference);
            }
          }
        },
        missing: undefined
      },
      metadataCache: metadataCacheByHash
    }
  });

  let hashCounter = 0;

  return {
    app,
    canvasReferences,
    files,
    resolveCalls,
    setNote(path: string, cache: CachedMetadata | undefined, hash?: string): void {
      if (!files.has(path)) {
        files.set(path, makeFile(path));
      }
      hashCounter++;
      const newHash = hash ?? `hash-${String(hashCounter)}`;
      fileCache[path] = { hash: newHash };
      if (cache) {
        metadataCacheByHash[newHash] = cache;
      }
    }
  };
}

/**
 * The walk Obsidian's `getBacklinksForFile` makes, restated against the fake vault: every cached note's
 * references plus the link updaters', each resolved.
 *
 * @param vault - The fake vault.
 * @param file - The target.
 * @returns The backlinks, keyed by source path, each list in visiting order.
 */
function fullWalk(vault: FakeVault, file: TFile): Map<string, Reference[]> {
  const result = new Map<string, Reference[]>();
  const metadataCache = vault.app.metadataCache;
  for (const [sourcePath, entry] of Object.entries(metadataCache.fileCache)) {
    const cache = metadataCache.metadataCache[entry.hash];
    for (const reference of [...cache?.frontmatterLinks ?? [], ...cache?.links ?? [], ...cache?.embeds ?? []]) {
      collect(sourcePath, reference);
    }
  }
  for (const { reference, sourcePath } of vault.canvasReferences) {
    collect(sourcePath, reference);
  }
  return result;

  function collect(sourcePath: string, reference: Reference): void {
    const hashIndex = reference.link.indexOf('#');
    const linkpath = hashIndex === -1 ? reference.link : reference.link.slice(0, hashIndex);
    if (metadataCache.getFirstLinkpathDest(linkpath, sourcePath) !== file) {
      return;
    }
    const list = result.get(sourcePath) ?? [];
    list.push(reference);
    result.set(sourcePath, list);
  }
}

function getTestFile(path: string): TFile {
  const file = currentVault.files.get(path);
  if (!file) {
    throw new Error(`No file at ${path}.`);
  }
  return file;
}

function link(text: string, start = 0): ReferenceCache {
  return {
    link: text,
    original: `[[${text}]]`,
    position: {
      end: { col: start + text.length + 4, line: 0, offset: start + text.length + 4 },
      start: { col: start, line: 0, offset: start }
    }
  };
}

function makeFile(path: string): TFile {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dotIndex = name.lastIndexOf('.');
  return castTo<TFile>({
    basename: dotIndex === -1 ? name : name.slice(0, dotIndex),
    extension: dotIndex === -1 ? '' : name.slice(dotIndex + 1),
    name,
    path
  });
}

function toMap(backlinks: ReturnType<typeof getIndexedBacklinksForFile>): Map<string, Reference[]> {
  return new Map(backlinks.keys().map((key) => [key, backlinks.get(key) ?? []]));
}

describe('getIndexedBacklinksForFile', () => {
  beforeEach(() => {
    currentVault = createVault();
    vi.clearAllMocks();
  });

  it('gives the full walk answer for every file of a randomized vault', () => {
    const vault = currentVault;
    const NOTE_COUNT = 60;
    const LINKS_PER_NOTE = 4;
    let seed = 42;
    const names = ['Alpha', 'beta', 'Gamma.Delta', 'image.png', 'Epsilon'];
    const folders = ['', 'a/', 'a/b/', 'C/'];
    const paths: string[] = [];
    for (let index = 0; index < NOTE_COUNT; index++) {
      const name = names[random(names.length)] ?? '';
      const folder = folders[random(folders.length)] ?? '';
      const extension = name.endsWith('.png') ? '' : '.md';
      const path = `${folder}${name}${extension}`;
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
    for (const path of paths) {
      vault.files.set(path, makeFile(path));
    }
    const linkTargets = [...paths.map((path) => path.replace(/\.md$/u, '')), ...names, 'ALPHA', 'missing', '', 'a/beta#Heading', 'image.png#x'];
    for (const path of paths) {
      if (path.endsWith('.png')) {
        continue;
      }
      const links: ReferenceCache[] = [];
      for (let index = 0; index < LINKS_PER_NOTE; index++) {
        links.push(link(linkTargets[random(linkTargets.length)] ?? ''));
      }
      vault.setNote(path, { embeds: [link('image.png')], frontmatterLinks: [{ key: 'up', link: 'Alpha', original: 'Alpha' }], links });
    }
    vault.canvasReferences.push({ reference: link('beta'), sourcePath: 'board.canvas' }, { reference: link('a/b/Epsilon'), sourcePath: 'board.canvas' });

    for (const file of vault.files.values()) {
      expect(toMap(getIndexedBacklinksForFile(vault.app, file))).toEqual(fullWalk(vault, file));
    }

    function random(limit: number): number {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % limit;
    }
  });

  it('resolves only the candidates, not every reference in the vault', () => {
    const vault = currentVault;
    const UNRELATED_NOTE_COUNT = 200;
    for (let index = 0; index < UNRELATED_NOTE_COUNT; index++) {
      vault.setNote(`notes/note-${String(index)}.md`, { links: [link(`note-${String((index + 1) % UNRELATED_NOTE_COUNT)}`)] });
    }
    vault.setNote('target.md', {});
    vault.setNote('holder.md', { links: [link('target'), link('note-1')] });

    const target = getTestFile('target.md');
    vault.resolveCalls.count = 0;
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['holder.md']);
    expect(vault.resolveCalls.count).toBe(2);
  });

  it('finds a note\'s own empty-linkpath reference', () => {
    currentVault.setNote('self.md', { links: [link('#Heading')] });
    expect(getIndexedBacklinksForFile(currentVault.app, getTestFile('self.md')).keys()).toEqual(['self.md']);
  });

  it('re-reads a note whose hash changed and forgets a note that left the cache', () => {
    const vault = currentVault;
    vault.setNote('target.md', {});
    vault.setNote('holder.md', { links: [link('target')] });
    vault.setNote('second.md', { links: [link('target')] });
    const target = getTestFile('target.md');
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['holder.md', 'second.md']);

    vault.setNote('holder.md', { links: [link('elsewhere')] });
    vault.setNote('other.md', { links: [link('Target')] });
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['second.md', 'other.md']);

    delete vault.app.metadataCache.fileCache['other.md'];
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['second.md']);

    vault.setNote('second.md', { links: [] });
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual([]);
  });

  it('looks again at a note whose metadata was not stored yet when it was first seen', () => {
    const vault = currentVault;
    vault.setNote('target.md', {});
    vault.setNote('holder.md', undefined, 'pending-hash');
    const target = getTestFile('target.md');
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual([]);

    vault.app.metadataCache.metadataCache['pending-hash'] = { links: [link('target')] };
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['holder.md']);
  });

  it('keeps one index per app and reuses it across queries', () => {
    const vault = currentVault;
    vault.setNote('target.md', {});
    vault.setNote('holder.md', { links: [link('target')] });
    const target = getTestFile('target.md');
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual(['holder.md']);

    const otherVault = createVault();
    otherVault.setNote('target.md', {});
    expect(getIndexedBacklinksForFile(otherVault.app, otherVault.files.get('target.md') ?? target).keys()).toEqual([]);

    /*
     * Swap the holder's metadata under the SAME hash. A rebuilt index would drop the holder as a candidate; the
     * reused one still lists it, so its one new reference is resolved, which is the single call counted below.
     */
    const holderHash = vault.app.metadataCache.fileCache['holder.md']?.hash ?? '';
    vault.app.metadataCache.metadataCache[holderHash] = { links: [link('elsewhere')] };
    vault.resolveCalls.count = 0;
    expect(getIndexedBacklinksForFile(vault.app, target).keys()).toEqual([]);
    expect(vault.resolveCalls.count).toBe(1);
  });
});
