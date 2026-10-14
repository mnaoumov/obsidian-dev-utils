import {
  dirname,
  join
} from 'node:path';
import {
  fileURLToPath,
  pathToFileURL
} from 'node:url';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getNanoStagedConfig,
  obsidianDevUtilsConfig
} from './nano-staged-config.ts';

const { mockExistsSync, mockExit, mockGetPackageManagerRunCommand, mockLoadEnvFile, mockStdoutWrite } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockExit: vi.fn(),
  /*
   * The run prefix is resolved at MODULE SCOPE, before any `beforeEach` runs, so the default
   * implementation has to be supplied here rather than in a hook. Without it the config's contents would
   * depend on whichever package manager launched vitest.
   */
  mockGetPackageManagerRunCommand: vi.fn<() => string[]>(() => ['npm', 'run']),
  mockLoadEnvFile: vi.fn(),
  mockStdoutWrite: vi.fn()
}));

vi.mock('./package-manager.ts', () => ({
  getPackageManagerRunCommand: mockGetPackageManagerRunCommand
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: mockExistsSync
}));

vi.mock('node:process', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:process')>();
  return {
    ...$module,
    default: {
      ...$module,
      exit: mockExit,
      loadEnvFile: mockLoadEnvFile,
      stdout: {
        ...$module.stdout,
        write: mockStdoutWrite
      }
    }
  };
});

describe('getNanoStagedConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    vi.stubEnv('NANO_STAGED', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return the shared config when NANO_STAGED is unset', () => {
    vi.stubEnv('NANO_STAGED', undefined);
    expect(getNanoStagedConfig()).toBe(obsidianDevUtilsConfig);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should run when NANO_STAGED is an on value', () => {
    vi.stubEnv('NANO_STAGED', '1');
    expect(getNanoStagedConfig()).toBe(obsidianDevUtilsConfig);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should load .env when it exists', () => {
    mockExistsSync.mockReturnValue(true);
    getNanoStagedConfig();
    expect(mockLoadEnvFile).toHaveBeenCalledWith('.env');
  });

  it('should not load .env when it is absent', () => {
    mockExistsSync.mockReturnValue(false);
    getNanoStagedConfig();
    expect(mockLoadEnvFile).not.toHaveBeenCalled();
  });

  it.each(['0', 'false', 'OFF', ' no '])('should skip and exit 0 when NANO_STAGED is %s', (value) => {
    vi.stubEnv('NANO_STAGED', value);
    getNanoStagedConfig();
    expect(mockStdoutWrite).toHaveBeenCalledWith('nano-staged: skipped (NANO_STAGED is off).\n');
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});

const COMPLEMENT_KEY = '!(*.{ts,tsx,mts}!(?)|*.md!(?))*';

interface GlobToRegexModule {
  globToRegex: (glob: string, options: GlobToRegexOptions) => GlobToRegexResult;
}

interface GlobToRegexOptions {
  readonly extended: boolean;
  readonly globstar: boolean;
}

interface GlobToRegexResult {
  readonly regex: RegExp;
}

async function getClaimingKeys(config: Record<string, string[]>, file: string): Promise<string[]> {
  const globToRegex = await loadGlobToRegex();
  return Object.keys(config).filter((pattern) => globToRegex(pattern, { extended: true, globstar: pattern.includes('/') }).regex.test(file));
}

/*
 * The compiler nano-staged itself uses, loaded from the installed package so the partition is pinned against
 * the dialect that actually runs. It is not in the package's `exports`, hence the path built off the entry.
 */
async function loadGlobToRegex(): Promise<GlobToRegexModule['globToRegex']> {
  const entryPath = fileURLToPath(import.meta.resolve('nano-staged'));
  // eslint-disable-next-line no-unsanitized/method -- the specifier is built from the resolved nano-staged entry, never from input.
  const $module = await import(pathToFileURL(join(dirname(entryPath), 'glob-to-regex.js')).href) as GlobToRegexModule;
  return $module.globToRegex;
}

describe('getNanoStagedConfig with additional writer tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    vi.stubEnv('NANO_STAGED', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return the shared config when the additional writer tasks are empty', () => {
    expect(getNanoStagedConfig({ additionalWriterTasks: {} })).toBe(obsidianDevUtilsConfig);
  });

  it('should re-partition spellcheck around an additional writer', async () => {
    const config = getNanoStagedConfig({ additionalWriterTasks: { '*.astro': ['npm run lint:fix --'] } });

    expect(config).toEqual({
      '!(*.{ts,tsx,mts}!(?)|*.md!(?)|*.astro!(?))*': ['npm run spellcheck --'],
      '*.{ts,tsx,mts}': ['npm run lint:fix --', 'npm run format --', 'npm run spellcheck --'],
      '*.astro': ['npm run lint:fix --', 'npm run spellcheck --'],
      '*.md': ['npm run lint:md:fix --', 'npm run spellcheck --']
    });
    expect(await getClaimingKeys(config, 'docs/src/components/card.astro')).toEqual(['*.astro']);
    expect(await getClaimingKeys(config, 'package.json')).toEqual(['!(*.{ts,tsx,mts}!(?)|*.md!(?)|*.astro!(?))*']);
  });

  it('should reject an additional writer pattern containing a slash', () => {
    expect(() => getNanoStagedConfig({ additionalWriterTasks: { 'docs/*.astro': ['npm run lint:fix --'] } }))
      .toThrow('nano-staged writer pattern \'docs/*.astro\' contains \'/\'');
  });

  it('should reject an additional writer pattern that repeats a shared one', () => {
    expect(() => getNanoStagedConfig({ additionalWriterTasks: { '*.md': ['npm run other --'] } }))
      .toThrow('nano-staged writer pattern \'*.md\' is already a shared writer pattern.');
  });
});

describe('obsidianDevUtilsConfig', () => {
  it('should run every task through npm when npm owns the tree', () => {
    expect(obsidianDevUtilsConfig).toEqual({
      '*.{ts,tsx,mts}': ['npm run lint:fix --', 'npm run format --', 'npm run spellcheck --'],
      '*.md': ['npm run lint:md:fix --', 'npm run spellcheck --'],
      [COMPLEMENT_KEY]: ['npm run spellcheck --']
    });
  });

  /*
   * The overlap this pins. nano-staged runs its per-pattern groups under `Promise.all`, so a catch-all `'*'`
   * spellcheck key read a staged file while `lint:fix` / `format` / `lint:md:fix` rewrote it in place. Every
   * staged file must be claimed by EXACTLY one key, and a writer key must spellcheck last.
   */
  it.each([
    ['src/main.ts', '*.{ts,tsx,mts}'],
    ['src/a b/view.tsx', '*.{ts,tsx,mts}'],
    ['eslint.config.mts', '*.{ts,tsx,mts}'],
    ['README.md', '*.md'],
    ['docs/guides/setup.md', '*.md'],
    ['package.json', COMPLEMENT_KEY],
    ['notes.md.bak', COMPLEMENT_KEY],
    ['data.tsv', COMPLEMENT_KEY],
    ['dir.md/data.json', COMPLEMENT_KEY],
    ['.husky/pre-commit', COMPLEMENT_KEY],
    ['LICENSE', COMPLEMENT_KEY]
  ])('should claim %s by exactly one key, %s, as nano-staged compiles it', async (file, expectedKey) => {
    expect(await getClaimingKeys(obsidianDevUtilsConfig, file)).toEqual([expectedKey]);
  });

  it('should run every task through the package manager that owns the tree', async () => {
    /*
     * The prefix is baked in when the module is evaluated, so the manager can only be changed by
     * re-evaluating it. `mockReturnValueOnce` is consumed by that single re-evaluation and restores the
     * npm default on its own, leaving nothing to undo for the tests that follow.
     */
    mockGetPackageManagerRunCommand.mockReturnValueOnce(['bun', 'run']);
    vi.resetModules();

    const { obsidianDevUtilsConfig: bunConfig } = await import('./nano-staged-config.ts');

    expect(bunConfig).toEqual({
      '*.{ts,tsx,mts}': ['bun run lint:fix --', 'bun run format --', 'bun run spellcheck --'],
      '*.md': ['bun run lint:md:fix --', 'bun run spellcheck --'],
      [COMPLEMENT_KEY]: ['bun run spellcheck --']
    });
  });

  /*
   * The regression this pins. An earlier `templates/` exclusion moved `lint:fix` onto a key of its own,
   * `!(templates)*.{ts,tsx,mts}`, which silently took the ordering away: nano-staged runs its per-pattern
   * groups under `Promise.all` and sequences only the commands inside a single key's array, so the two
   * writers of one file raced and whichever finished last won.
   */
  it('should keep both file-rewriting tasks under one key, in order', () => {
    const keysRewritingTypeScript = Object.entries(obsidianDevUtilsConfig)
      .filter(([, commands]) => commands.some((command) => command.includes('lint:fix') || command.includes(' format ')))
      .map(([key]) => key);

    expect(keysRewritingTypeScript).toEqual(['*.{ts,tsx,mts}']);
    expect(obsidianDevUtilsConfig['*.{ts,tsx,mts}']).toEqual([
      'npm run lint:fix --',
      'npm run format --',
      'npm run spellcheck --'
    ]);
  });
});
