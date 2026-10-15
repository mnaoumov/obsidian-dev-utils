import type { Plugin } from 'esbuild';

import {
  existsSync,
  readFileSync
} from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  join
} from 'node:path';
import process from 'node:process';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ParsedTsConfig } from './check-project-types.ts';

import {
  buildCleanLibrary,
  buildLibrary,
  buildLibraryTypes,
  generateLibraryExports,
  generateLibraryIndex,
  LIBRARY_BANNER,
  LIBRARY_BUILD_STEPS,
  runBuildSteps,
  SOURCE_CONDITION
} from './library-build.ts';

const {
  mockExecFromRoot,
  mockNpmRunOptional,
  mockParseTsConfig
} = vi.hoisted(() => ({
  mockExecFromRoot: vi.fn(),
  mockNpmRunOptional: vi.fn(),
  mockParseTsConfig: vi.fn<(tsConfigPath: string) => ParsedTsConfig>()
}));

vi.mock('./root.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./root.ts')>();
  return {
    ...$module,
    execFromRoot: mockExecFromRoot
  };
});

vi.mock('./npm-run.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./npm-run.ts')>();
  return {
    ...$module,
    npmRunOptional: mockNpmRunOptional
  };
});

vi.mock('./check-project-types.ts', async (importOriginal) => {
  const $module = await importOriginal<typeof import('./check-project-types.ts')>();
  return {
    ...$module,
    parseTsConfig: mockParseTsConfig
  };
});

/*
 * Each case bundles real files with esbuild, which is quick alone and slow under the full suite's load.
 */
const BUILD_TEST_TIMEOUT_IN_MILLISECONDS = 30_000;

interface PackageJsonWithExports {
  exports: Record<string, unknown>;
}

let originalCwd = '';
let packageFolder = '';

// The directive is assembled, never written out: the build of THIS package scans its own sources, tests included,
// for it, and would read a literal one here as a lib this package needs.
function libReference(lib: string): string {
  return ['///', ` <reference lib="${lib}" />`].join('');
}

function makeParsedTsConfig(options: ParsedTsConfig['options']): ParsedTsConfig {
  const parsedTsConfig: Partial<ParsedTsConfig> = { fileNames: [], options };
  return parsedTsConfig as ParsedTsConfig;
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8');
}

async function writeFiles(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

beforeEach(async () => {
  originalCwd = process.cwd();
  packageFolder = await mkdtemp(join(tmpdir(), 'library-build-'));
  process.chdir(packageFolder);
  await writeFiles({ 'package.json': '{ "name": "fixture" }\n' });
  mockExecFromRoot.mockReset();
  mockNpmRunOptional.mockReset();
  mockParseTsConfig.mockReset();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(packageFolder, { force: true, recursive: true });
});

describe('constants', () => {
  it('names the source condition and the banner', () => {
    expect(SOURCE_CONDITION).toBe('@mnaoumov/source');
    expect(LIBRARY_BANNER).toContain('GENERATED/BUNDLED FILE BY ESBUILD');
  });
});

describe('runBuildSteps', () => {
  it('runs the library steps in order by default', async () => {
    await runBuildSteps();

    expect(mockNpmRunOptional.mock.calls.map(([step]) => step as string)).toEqual([...LIBRARY_BUILD_STEPS]);
  });

  it('runs the steps it is given', async () => {
    await runBuildSteps(['build:a', 'build:b']);

    expect(mockNpmRunOptional.mock.calls).toEqual([['build:a'], ['build:b']]);
  });
});

describe('buildCleanLibrary', () => {
  it('removes dist, the generated barrels and declarations, and the subpath package.json stubs', async () => {
    await writeFiles({
      'dist/lib/esm/a.mjs': '',
      'node_modules/dependency/package.json': '{}',
      'src/@types/kept.d.ts': '',
      'src/a.d.ts': '',
      'src/a.ts': '',
      'src/index.ts': '',
      'src/sub/index.ts': '',
      'sub/package.json': '{}'
    });

    await buildCleanLibrary();

    expect(existsSync('dist')).toBe(false);
    expect(existsSync('src/index.ts')).toBe(false);
    expect(existsSync('src/sub/index.ts')).toBe(false);
    expect(existsSync('src/a.d.ts')).toBe(false);
    expect(existsSync('sub/package.json')).toBe(false);
    expect(existsSync('src/@types/kept.d.ts')).toBe(true);
    expect(existsSync('src/a.ts')).toBe(true);
    expect(existsSync('package.json')).toBe(true);
    expect(existsSync('node_modules/dependency/package.json')).toBe(true);
  });
});

describe('generateLibraryIndex', () => {
  it('re-exports every module and every non-empty sub-barrel, and nothing else', async () => {
    await writeFiles({
      'src/@types/ambient.d.ts': '',
      'src/a.ts': '',
      'src/b.test.ts': '',
      'src/c.d.ts': '',
      'src/empty/readme.md': '',
      'src/notes.md': '',
      'src/setup.ts': '',
      'src/styles/main.scss': '',
      'src/sub/d.ts': '',
      'src/test-helpers/helper.ts': '',
      'src/vitest-setup.ts': ''
    });

    await generateLibraryIndex();

    expect(readText('src/index.ts')).toBe([
      '/* THIS IS A GENERATED/BUNDLED FILE BY BUILD SCRIPT */',
      '',
      'export * as \'a\' from \'./a.ts\';',
      'export * as \'sub\' from \'./sub/index.ts\';',
      ''
    ].join('\n'));
    expect(readText('src/sub/index.ts')).toContain('export * as \'d\' from \'./d.ts\';');
    expect(existsSync('src/empty/index.ts')).toBe(false);
  });

  it('writes no barrel for a source folder with nothing to export', async () => {
    await writeFiles({ 'src/readme.md': '' });

    await generateLibraryIndex();

    expect(existsSync('src/index.ts')).toBe(false);
  });
});

describe('buildLibraryTypes', () => {
  it('writes a .d.cts and a .d.mts per declaration, with the index carrying the lib and types references', async () => {
    mockParseTsConfig.mockReturnValue(makeParsedTsConfig({ lib: ['lib.es2022.d.ts', 'lib.dom.iterable.d.ts'], types: ['vitest', 'node'] }));
    await writeFiles({
      'src/a.ts': `${libReference('WebWorker')}\n`,
      'src/index.d.ts': 'export * as \'a\' from \'./a.ts\';\n',
      'src/notes.md': `${libReference('ignored')}\n`,
      'src/other.d.ts': 'export declare const x: typeof import(\'./a.ts\');\n',
      'src/sub/b.d.ts': [
        'import type { Promisable } from \'type-fest\';',
        'import { a } from \'../a.ts\';',
        'export declare const b: typeof import("./c.ts") | import("type-fest").Primitive | Promisable<typeof a>;',
        ''
      ].join('\n'),
      'src/test-helpers/helper.d.ts': ''
    });

    await buildLibraryTypes();

    expect(mockExecFromRoot).toHaveBeenCalledWith(expect.arrayContaining(['--project', './tsconfig.types.json']));

    expect(readText('dist/lib/cjs/index.d.cts')).toBe([
      libReference('dom.iterable'),
      libReference('es2022'),
      libReference('webworker'),
      '/// <reference types="node" />',
      'export * as \'a\' from \'./a.cjs\';',
      ''
    ].join('\n'));
    expect(readText('dist/lib/esm/index.d.mts')).toContain('export * as \'a\' from \'./a.mjs\';');

    expect(readText('dist/lib/cjs/other.d.cts')).toBe('/// <reference path="./index.d.cts" />\nexport declare const x: typeof import(\'./a.cjs\');\n');
    expect(readText('dist/lib/esm/other.d.mts')).toBe('/// <reference path="./index.d.mts" />\nexport declare const x: typeof import(\'./a.mjs\');\n');

    const subCts = readText('dist/lib/cjs/sub/b.d.cts');
    expect(subCts).toContain('/// <reference path="../index.d.cts" />');
    expect(subCts).toContain('import type { Promisable } from \'type-fest\' with { \'resolution-mode\': \'import\' };');
    expect(subCts).toContain('from \'../a.cjs\';');
    expect(subCts).toContain('import("./c.cjs")');
    expect(subCts).toContain('import("type-fest", { with: { \'resolution-mode\': \'import\' } }).Primitive');

    const subMts = readText('dist/lib/esm/sub/b.d.mts');
    expect(subMts).toContain('import type { Promisable } from \'type-fest\';');
    expect(subMts).toContain('import("./c.mjs")');

    expect(existsSync('dist/lib/cjs/test-helpers')).toBe(false);
  });

  it('anchors the references on library.ts where the package has one, with no lib or types configured', async () => {
    mockParseTsConfig.mockReturnValue(makeParsedTsConfig({}));
    await writeFiles({
      'src/index.d.ts': '',
      'src/library.d.ts': '',
      'src/library.ts': ''
    });

    await buildLibraryTypes();

    expect(readText('dist/lib/cjs/library.d.cts')).toBe('\n');
    expect(readText('dist/lib/cjs/index.d.cts')).toBe('/// <reference path="./library.d.cts" />\n');
  });
});

describe('generateLibraryExports', () => {
  async function writeLibraryTree(): Promise<void> {
    await writeFiles({
      'dist/lib/cjs/@types/ambient.d.cts': '',
      'dist/lib/cjs/@types/notes.txt': '',
      'dist/lib/cjs/index.d.cts': '',
      'dist/lib/cjs/no-index/x.d.cts': '',
      'dist/lib/cjs/sub/index.d.cts': '',
      'dist/lib/cjs/sub/y.cjs': '',
      'dist/lib/cjs/sub/y.d.cts': '',
      'src/@types/ambient.d.ts': '',
      'src/index.ts': '',
      'src/no-index/x.ts': '',
      'src/styles/main.scss': '',
      'src/sub/index.ts': '',
      'src/sub/y.ts': '',
      'src/test-helpers/helper.ts': ''
    });
  }

  it('regenerates the exports map and the subpath stubs, and refuses to pass while the map changed', async () => {
    await writeLibraryTree();

    await expect(generateLibraryExports({ sourceCondition: SOURCE_CONDITION })).rejects.toThrow('Package exports have changed');

    const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as PackageJsonWithExports;
    expect(Object.keys(packageJson.exports)).toEqual(['.', './*', './@types/*', './no-index/*', './sub', './sub/*']);
    expect(packageJson.exports['.']).toEqual({
      import: { default: './dist/lib/esm/index.mjs', types: './dist/lib/esm/index.d.mts' },
      require: { default: './dist/lib/cjs/index.cjs', types: './dist/lib/cjs/index.d.cts' },
      [SOURCE_CONDITION]: './src/index.ts'
    });
    expect(packageJson.exports['./@types/*']).toEqual({
      import: { types: './dist/lib/esm/@types/*.d.mts' },
      require: { types: './dist/lib/cjs/@types/*.d.cts' }
    });

    expect(JSON.parse(readText('sub/package.json'))).toEqual({
      main: '../dist/lib/cjs/sub/index.cjs',
      module: '../dist/lib/esm/sub/index.mjs',
      type: 'module',
      types: '../dist/lib/cjs/sub/index.d.cts'
    });
    expect(JSON.parse(readText('sub/y/package.json'))).toEqual({
      main: '../../dist/lib/cjs/sub/y.cjs',
      module: '../../dist/lib/esm/sub/y.mjs',
      type: 'module',
      types: '../../dist/lib/cjs/sub/y.d.cts'
    });
    expect(JSON.parse(readText('@types/ambient/package.json'))).toEqual({
      type: 'module',
      types: '../../dist/lib/cjs/@types/ambient.d.cts'
    });
    expect(existsSync('no-index/package.json')).toBe(false);
    expect(existsSync('no-index/x/package.json')).toBe(true);

    await expect(generateLibraryExports({ sourceCondition: SOURCE_CONDITION })).resolves.toBeUndefined();
  });

  it('writes no source condition when none is asked for', async () => {
    await writeLibraryTree();

    await expect(generateLibraryExports()).rejects.toThrow('Package exports have changed');

    const packageJson = JSON.parse(await readFile('package.json', 'utf-8')) as PackageJsonWithExports;
    expect(packageJson.exports['.']).toEqual({
      import: { default: './dist/lib/esm/index.mjs', types: './dist/lib/esm/index.d.mts' },
      require: { default: './dist/lib/cjs/index.cjs', types: './dist/lib/cjs/index.d.cts' }
    });
    expect(JSON.stringify(packageJson.exports)).not.toContain(SOURCE_CONDITION);

    await expect(generateLibraryExports()).resolves.toBeUndefined();
  });

  it('writes a types-only stub for a types folder that has an index', async () => {
    await writeFiles({
      'dist/lib/cjs/@types/index.d.cts': '',
      'dist/lib/cjs/index.d.cts': '',
      'src/@types/index.ts': '',
      'src/index.ts': ''
    });

    await expect(generateLibraryExports()).rejects.toThrow('Package exports have changed');

    expect(JSON.parse(readText('@types/package.json'))).toEqual({
      type: 'module',
      types: '../dist/lib/cjs/@types/index.d.cts'
    });
  });
});

describe('buildLibrary', { timeout: BUILD_TEST_TIMEOUT_IN_MILLISECONDS }, () => {
  async function writeSources(): Promise<void> {
    await writeFiles({
      'src/a.test.ts': 'throw new Error(\'not built\');\n',
      'src/a.ts': 'export const a = 1;\n',
      'src/c.d.ts': 'export declare const c: number;\n',
      'src/sub/b.ts': 'import { a } from \'../a.ts\';\nexport const b = a + 1;\n',
      'src/test-helpers/helper.ts': 'throw new Error(\'not built\');\n'
    });
    for (const folder of ['dist/lib/cjs/sub', 'dist/lib/esm/sub']) {
      await mkdir(folder, { recursive: true });
    }
  }

  it('builds every source module into both formats with the generic banner', async () => {
    await writeSources();

    await buildLibrary();

    const cjs = readText('dist/lib/cjs/sub/b.cjs');
    expect(cjs).toContain(LIBRARY_BANNER.trim());
    expect(cjs).toContain('require(\'../a.cjs\')');
    expect(cjs).not.toContain('isMobile');
    expect(readText('dist/lib/esm/sub/b.mjs')).toContain('from "../a.mjs"');
    expect(existsSync('dist/lib/cjs/a.test.cjs')).toBe(false);
    expect(existsSync('dist/lib/cjs/test-helpers/helper.cjs')).toBe(false);
    expect(existsSync('dist/lib/cjs/c.d.cjs')).toBe(false);
  });

  it('builds with the preprocess plugin the caller supplies', async () => {
    await writeSources();
    const formats: boolean[] = [];

    await buildLibrary({
      preprocessPluginFactory: (isEsm): Plugin => {
        formats.push(isEsm);
        return { name: 'custom-preprocess', setup: (): void => undefined };
      }
    });

    expect(formats).toEqual([false, true]);
    expect(readText('dist/lib/esm/a.mjs')).not.toContain('ensureDisposeSymbols');
  });

  it('fails when esbuild does', async () => {
    await writeSources();
    await writeFiles({ 'src/broken.ts': 'export const = ;\n' });

    await expect(buildLibrary()).rejects.toThrow();
  });
});
