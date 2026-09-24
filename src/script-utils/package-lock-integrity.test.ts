import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import type { PackageLockJson } from './npm.ts';

import {
  assertPackageLockIntegrity,
  findPackageLockEntriesMissingIntegrity
} from './package-lock-integrity.ts';

const REGISTRY_ENTRY = {
  integrity: 'sha512-abc',
  resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
  version: '1.0.0'
};

function toLock(packages: Record<string, object>): PackageLockJson {
  return { packages } as PackageLockJson;
}

describe('findPackageLockEntriesMissingIntegrity', () => {
  it('should find nothing in a complete lock', () => {
    expect(findPackageLockEntriesMissingIntegrity(toLock({
      '': { name: 'root' },
      'node_modules/a': REGISTRY_ENTRY,
      'node_modules/a/node_modules/b': REGISTRY_ENTRY
    }))).toEqual([]);
  });

  it('should find an entry with neither field, and one missing either', () => {
    expect(findPackageLockEntriesMissingIntegrity(toLock({
      'node_modules/a': { version: '1.0.0' },
      'node_modules/b': { resolved: REGISTRY_ENTRY.resolved, version: '1.0.0' },
      'node_modules/c': { integrity: REGISTRY_ENTRY.integrity, version: '1.0.0' },
      'node_modules/d': REGISTRY_ENTRY
    }))).toEqual(['node_modules/a', 'node_modules/b', 'node_modules/c']);
  });

  it('should skip the root, links, workspace sources and bundled dependencies', () => {
    expect(findPackageLockEntriesMissingIntegrity(toLock({
      '': { version: '1.0.0' },
      'node_modules/a/node_modules/bundled': { inBundle: true, version: '1.0.0' },
      'node_modules/linked': { link: true, resolved: 'packages/linked' },
      'packages/linked': { version: '1.0.0' }
    }))).toEqual([]);
  });

  it('should not require integrity for a git dependency', () => {
    expect(findPackageLockEntriesMissingIntegrity(toLock({
      'node_modules/a': { resolved: 'git+ssh://git@github.com/o/a.git#0123456', version: '1.0.0' }
    }))).toEqual([]);
  });

  it('should treat a lock without packages as complete', () => {
    expect(findPackageLockEntriesMissingIntegrity({})).toEqual([]);
  });
});

describe('assertPackageLockIntegrity', () => {
  let folder = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'package-lock-integrity-'));
    await writeFile(join(folder, 'package.json'), '{"name":"fixture"}');
  });

  afterEach(async () => {
    await rm(folder, { force: true, recursive: true });
  });

  async function writeLock(packages: Record<string, object>): Promise<void> {
    await writeFile(join(folder, 'package-lock.json'), JSON.stringify(toLock(packages)));
  }

  it('should pass a project with no package-lock.json', async () => {
    await expect(assertPackageLockIntegrity(folder)).resolves.toBeUndefined();
  });

  it('should pass a complete lock', async () => {
    await writeLock({ 'node_modules/a': REGISTRY_ENTRY });
    await expect(assertPackageLockIntegrity(folder)).resolves.toBeUndefined();
  });

  it('should name the count and every key when there are few', async () => {
    await writeLock({ 'node_modules/a': { version: '1.0.0' }, 'node_modules/b': { version: '1.0.0' } });
    const promise = assertPackageLockIntegrity(folder);
    await expect(promise).rejects.toThrow('2 installed package(s)');
    await expect(promise).rejects.toThrow('  node_modules/a\n  node_modules/b\n');
    await expect(promise).rejects.toThrow('PACKAGE_LOCK_INTEGRITY=0');
  });

  it('should name the first keys and count the rest when there are many', async () => {
    const packages: Record<string, object> = {};
    for (let index = 0; index < 8; index++) {
      packages[`node_modules/p${String(index)}`] = { version: '1.0.0' };
    }
    await writeLock(packages);
    const promise = assertPackageLockIntegrity(folder);
    await expect(promise).rejects.toThrow('8 installed package(s)');
    await expect(promise).rejects.toThrow('  node_modules/p4\n  ... and 3 more\n');
  });
});
