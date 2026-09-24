/**
 * @file
 *
 * Answers "which references resolve to this file?" by looking only at the notes that COULD hold one, instead of
 * resolving every reference in the vault.
 *
 * Obsidian's `metadataCache.getBacklinksForFile(file)` is not an index lookup. Read out of the 1.14.2 bundle, it is
 * `iterateAllRefs` — every `frontmatterLinks`, `links` and `embeds` entry of every cached note, plus every
 * reference each `linkUpdaters` entry (the canvas one) reports — with one `getFirstLinkpathDest` per reference,
 * keeping those that resolve to `file`. That is ~115 ms at 100k references and ~320 ms at 250k, paid once per file
 * by every per-file backlink lookup, so a 1000-note folder rename in a 50k-note vault took 924 s.
 *
 * What makes a narrower answer exact is a property of Obsidian's `getLinkpathDest`: every branch of it can only
 * return a file whose lowercased name is the lowercased last `/` segment of the linkpath, or that segment plus
 * `.md`. The one exception is the empty linkpath (`[[#Heading]]`), which returns the source note itself. So a
 * note can hold a reference to `file` only if it holds a reference whose last segment matches one of `file`'s
 * name keys, or if it IS `file`. This module indexes notes by those segments, takes the candidates for `file`,
 * and runs Obsidian's own predicate — `getFirstLinkpathDest(linkpath, source) === file` — over the candidates'
 * references only. The candidates are a superset of the real backlinks and the predicate is the same one, so
 * the answer is the one the full walk gives, a file registered at a non-existing path included. Only the ORDER
 * of the notes in the answer differs: the file itself first, then the candidates in index order.
 *
 * The index is kept fresh without listening to anything. `metadataCache.fileCache` maps a note to the hash of
 * its content, and the references are a function of that hash, so each query compares every note's hash
 * against the one it was indexed at and re-reads only the notes that changed. That is one property comparison
 * per note and no resolution at all, the same order as the scan Obsidian itself runs on every rename
 * (`updateRelatedLinks`). Depending on no event also means depending on no event ORDER, which matters because
 * rename handlers query from inside the vault `rename` event.
 *
 * There is one index per `App`, held in the realm-global shared-state bag, so every plugin bundling this library
 * shares it rather than each building its own. What is stored there is plain data read structurally (maps and
 * sets, never a class instance), because the bag crosses copies of this library at different versions. The key
 * carries a version: a change to what a key MEANS (how a name key is derived) must move to a new key, so an older
 * copy never reads an index built by different rules.
 *
 * The `linkUpdaters` side is still walked in full on every query. In 1.14.2 the only updater is the canvas
 * one, whose references live in the canvas index rather than in `fileCache`, so there is no hash to key them
 * by; a vault's canvases hold a small fraction of its references.
 */

import type { CustomArrayDict } from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  CachedMetadata,
  Reference,
  TFile
} from 'obsidian';

import { CustomArrayDictImpl } from '@obsidian-typings/obsidian-public-latest/implementations';

import { getObsidianDevUtilsState } from '../obsidian-dev-utils-state.ts';
import { ensureNonNullable } from '../type-guards.ts';

interface BacklinkIndexData {
  readonly indexedHashes: Map<string, string>;
  readonly nameKeySourcePaths: Map<string, Set<string>>;
  readonly sourcePathNameKeys: Map<string, Set<string>>;
}

const MARKDOWN_SUFFIX = '.md';

/**
 * The same answer as `app.metadataCache.getBacklinksForFile(file)` (Obsidian's own, unpatched), from the candidate
 * notes only. See the file header for why the answer is exact.
 *
 * @param app - The Obsidian app instance.
 * @param file - The file whose backlinks to find. It may be a non-existing file registered for the query.
 * @returns The references that resolve to `file`, keyed by the path of the note or canvas holding them.
 */
export function getIndexedBacklinksForFile(app: App, file: TFile): CustomArrayDict<Reference> {
  const data = getBacklinkIndexData(app);
  refresh(app, data);

  const metadataCache = app.metadataCache;
  const backlinks = new CustomArrayDictImpl<Reference>();

  // The file itself is a candidate for its own `[[#Heading]]` references, whose empty linkpath names no segment.
  const candidateSourcePaths = new Set<string>([file.path]);
  for (const nameKey of getTargetNameKeys(file.name)) {
    for (const sourcePath of data.nameKeySourcePaths.get(nameKey) ?? []) {
      candidateSourcePaths.add(sourcePath);
    }
  }

  for (const sourcePath of candidateSourcePaths) {
    for (const reference of getCacheReferences(getCachedMetadata(app, sourcePath))) {
      collect(sourcePath, reference);
    }
  }

  for (const linkUpdater of Object.values(metadataCache.linkUpdaters)) {
    linkUpdater?.iterateReferences(collect);
  }

  return backlinks;

  function collect(sourcePath: string, reference: Reference): void {
    if (metadataCache.getFirstLinkpathDest(getLinkpath(reference.link), sourcePath) === file) {
      backlinks.add(sourcePath, reference);
    }
  }
}

function getBacklinkIndexData(app: App): BacklinkIndexData {
  const indexes = getObsidianDevUtilsState('backlinkIndexesByAppV1', new WeakMap<App, BacklinkIndexData>()).value;
  let data = indexes.get(app);
  if (!data) {
    data = {
      indexedHashes: new Map<string, string>(),
      nameKeySourcePaths: new Map<string, Set<string>>(),
      sourcePathNameKeys: new Map<string, Set<string>>()
    };
    indexes.set(app, data);
  }
  return data;
}

function getCachedMetadata(app: App, sourcePath: string): CachedMetadata | undefined {
  const hash = app.metadataCache.fileCache[sourcePath]?.hash;
  return hash === undefined ? undefined : app.metadataCache.metadataCache[hash];
}

/**
 * Lists a cached note's references in the order Obsidian's own walk visits them: `frontmatterLinks`, then
 * `links`, then `embeds`.
 *
 * @param cache - The note's cached metadata.
 * @returns The note's references.
 */
function getCacheReferences(cache: CachedMetadata | undefined): Reference[] {
  return cache ? [...cache.frontmatterLinks ?? [], ...cache.links ?? [], ...cache.embeds ?? []] : [];
}

/**
 * Strips the subpath from a link, the way Obsidian's `getLinkpath` does.
 *
 * @param link - The link text, such as `folder/Note#Heading`.
 * @returns The linkpath, such as `folder/Note`.
 */
function getLinkpath(link: string): string {
  const hashIndex = link.indexOf('#');
  return hashIndex === -1 ? link : link.slice(0, hashIndex);
}

/**
 * The key a reference is indexed under: the lowercased last `/` segment of its linkpath.
 *
 * @param link - The reference's link text.
 * @returns The key.
 */
function getReferenceNameKey(link: string): string {
  const linkpath = getLinkpath(link).toLowerCase();
  return linkpath.slice(linkpath.lastIndexOf('/') + 1);
}

/**
 * The keys under which a reference to a file with this name can be indexed. `getLinkpathDest` matches a
 * segment against the file's name, and against the name with `.md` appended, so a note named `Note.md` is
 * reachable from both `note.md` and `note`.
 *
 * @param fileName - The file's name, extension included.
 * @returns The keys.
 */
function getTargetNameKeys(fileName: string): string[] {
  const nameKey = fileName.toLowerCase();
  return nameKey.endsWith(MARKDOWN_SUFFIX) ? [nameKey, nameKey.slice(0, -MARKDOWN_SUFFIX.length)] : [nameKey];
}

function indexSource(app: App, data: BacklinkIndexData, sourcePath: string, hash: string): void {
  removeSource(data, sourcePath);
  const cache = app.metadataCache.metadataCache[hash];
  /*
   * A note's `fileCache` entry can carry its new hash before the metadata for that hash is stored. Recording
   * the hash then would pin the note at "no references" until its content changed again, so leave it
   * unrecorded and let the next query look again.
   */
  if (!cache) {
    return;
  }

  const nameKeys = new Set<string>();
  for (const reference of getCacheReferences(cache)) {
    nameKeys.add(getReferenceNameKey(reference.link));
  }
  for (const nameKey of nameKeys) {
    let sourcePaths = data.nameKeySourcePaths.get(nameKey);
    if (!sourcePaths) {
      sourcePaths = new Set<string>();
      data.nameKeySourcePaths.set(nameKey, sourcePaths);
    }
    sourcePaths.add(sourcePath);
  }
  data.sourcePathNameKeys.set(sourcePath, nameKeys);
  data.indexedHashes.set(sourcePath, hash);
}

function refresh(app: App, data: BacklinkIndexData): void {
  const fileCache = app.metadataCache.fileCache;

  for (const sourcePath of data.sourcePathNameKeys.keys()) {
    if (!Object.hasOwn(fileCache, sourcePath)) {
      removeSource(data, sourcePath);
    }
  }

  for (const [sourcePath, { hash }] of Object.entries(fileCache)) {
    if (data.indexedHashes.get(sourcePath) !== hash) {
      indexSource(app, data, sourcePath, hash);
    }
  }
}

function removeSource(data: BacklinkIndexData, sourcePath: string): void {
  for (const nameKey of data.sourcePathNameKeys.get(sourcePath) ?? []) {
    const sourcePaths = ensureNonNullable(data.nameKeySourcePaths.get(nameKey));
    sourcePaths.delete(sourcePath);
    if (sourcePaths.size === 0) {
      data.nameKeySourcePaths.delete(nameKey);
    }
  }
  data.sourcePathNameKeys.delete(sourcePath);
  data.indexedHashes.delete(sourcePath);
}
