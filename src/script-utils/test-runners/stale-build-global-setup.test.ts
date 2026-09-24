import type { TestProject } from 'vitest/node';

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join
} from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../../object-utils.ts';
import {
  findStaleBuild,
  formatStaleBuildMessage,
  setup
} from './stale-build-global-setup.ts';

const BUILD_TIME = new Date('2026-09-20T10:00:00.000Z');
const BEFORE_BUILD = new Date('2026-09-19T10:00:00.000Z');
const AFTER_BUILD = new Date('2026-09-21T10:00:00.000Z');
const LATEST = new Date('2026-09-22T10:00:00.000Z');

describe('stale-build-global-setup', () => {
  let rootFolder: string;

  beforeEach(() => {
    rootFolder = mkdtempSync(join(tmpdir(), 'stale-build-'));
  });

  afterEach(() => {
    rmSync(rootFolder, { force: true, recursive: true });
  });

  function writeFile(relativePath: string, modifiedAt: Date): void {
    const path = join(rootFolder, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
    utimesSync(path, modifiedAt, modifiedAt);
  }

  function writeBuild(): void {
    writeFile('dist/build/main.js', BUILD_TIME);
  }

  describe('findStaleBuild', () => {
    it('should report a missing build', () => {
      writeFile('src/main.ts', BEFORE_BUILD);
      expect(findStaleBuild({ rootFolder })).toEqual({ kind: 'missing' });
    });

    it('should accept a build newer than every input', () => {
      writeBuild();
      writeFile('src/main.ts', BEFORE_BUILD);
      writeFile('src/nested/helper.ts', BEFORE_BUILD);
      writeFile('manifest.json', BEFORE_BUILD);
      writeFile('styles.css', BEFORE_BUILD);
      expect(findStaleBuild({ rootFolder })).toBeNull();
    });

    it('should accept a build when the repo has no src folder and no root inputs', () => {
      writeBuild();
      expect(findStaleBuild({ rootFolder })).toBeNull();
    });

    it('should name the newest source file that is newer than the build', () => {
      writeBuild();
      writeFile('src/main.ts', AFTER_BUILD);
      writeFile('src/nested/helper.ts', LATEST);
      writeFile('src/other.ts', BEFORE_BUILD);
      expect(findStaleBuild({ rootFolder })).toEqual({
        buildModifiedAt: BUILD_TIME,
        kind: 'outdated',
        newestInputModifiedAt: LATEST,
        newestInputPath: 'src/nested/helper.ts'
      });
    });

    it('should treat the root manifest and stylesheet as build inputs', () => {
      writeBuild();
      writeFile('src/main.ts', BEFORE_BUILD);
      writeFile('styles.css', AFTER_BUILD);
      expect(findStaleBuild({ rootFolder })).toMatchObject({ newestInputPath: 'styles.css' });

      writeFile('manifest.json', LATEST);
      expect(findStaleBuild({ rootFolder })).toMatchObject({ newestInputPath: 'manifest.json' });
    });

    it('should ignore test files and test helpers, which are not build inputs', () => {
      writeBuild();
      writeFile('src/main.ts', BEFORE_BUILD);
      writeFile('src/main.test.ts', LATEST);
      writeFile('src/feature.desktop.integration.test.ts', LATEST);
      writeFile('src/test-helpers/fake.ts', LATEST);
      expect(findStaleBuild({ rootFolder })).toBeNull();
    });

    it('should not mistake a sibling folder sharing the test-helpers prefix for it', () => {
      writeBuild();
      writeFile('src/test-helpers-extra/real.ts', AFTER_BUILD);
      expect(findStaleBuild({ rootFolder })).toMatchObject({ newestInputPath: 'src/test-helpers-extra/real.ts' });
    });
  });

  describe('formatStaleBuildMessage', () => {
    it('should tell the reader to build when the build is missing', () => {
      expect(formatStaleBuildMessage({ kind: 'missing' })).toBe(
        'dist/build/main.js does not exist, so there is no plugin for the integration tests to load. Run `npm run build` first.'
      );
    });

    it('should name the input and both times when the build is outdated', () => {
      expect(formatStaleBuildMessage({
        buildModifiedAt: BUILD_TIME,
        kind: 'outdated',
        newestInputModifiedAt: LATEST,
        newestInputPath: 'src/main.ts'
      })).toBe(
        'dist/build/main.js is older than src/main.ts (built 2026-09-20T10:00:00.000Z, changed 2026-09-22T10:00:00.000Z), '
          + 'so the integration tests would run the previous build instead of the current source. Run `npm run build` first.'
      );
    });
  });

  describe('setup', () => {
    function createProject(): TestProject {
      return castTo<TestProject>({ config: { root: rootFolder } });
    }

    it('should pass when the build is current', () => {
      writeBuild();
      writeFile('src/main.ts', BEFORE_BUILD);
      expect(() => {
        setup(createProject());
      }).not.toThrow();
    });

    it('should throw when the build is stale', () => {
      writeBuild();
      writeFile('src/main.ts', AFTER_BUILD);
      expect(() => {
        setup(createProject());
      }).toThrow('is older than');
    });
  });
});
