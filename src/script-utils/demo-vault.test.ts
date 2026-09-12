import type { Unzipped } from 'fflate';
import type { Dirent } from 'node:fs';

import { unzipSync } from 'fflate';
import { Buffer } from 'node:buffer';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolvePathFromRootSafeParams } from './root.ts';

import {
  basename,
  dirname,
  join,
  relative
} from '../path.ts';
import { strictProxy } from '../strict-proxy.ts';
import { EMPTY } from '../string.ts';
import { archivePluginDemoVault } from './demo-vault.ts';

const {
  mockCp,
  mockExistsSync,
  mockGetRootFolder,
  mockMkdir,
  mockReaddir,
  mockReadFile,
  mockResolvePathFromRootSafe,
  mockWriteFile
} = vi.hoisted(() => ({
  mockCp: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockMkdir: vi.fn(),
  mockReaddir: vi.fn<(path: string) => Promise<Dirent[]>>(),
  mockReadFile: vi.fn<(path: string, encoding?: string) => Promise<Buffer | string>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockWriteFile: vi.fn<(path: string, data: string | Uint8Array, encoding?: string) => Promise<void>>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs')>();
  return {
    ...$module,
    existsSync: mockExistsSync
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...$module,
    cp: mockCp,
    mkdir: mockMkdir,
    readdir: mockReaddir,
    readFile: mockReadFile,
    writeFile: mockWriteFile
  };
});

vi.mock('./root.ts', () => ({
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

const MANIFEST_PATH = '/root/manifest.json';
const MANIFEST_CONTENT = JSON.stringify({
  id: 'my-plugin',
  version: '1.2.3'
});
const ARCHIVE_PATH = '/root/dist/build/my-plugin-demo-vault.zip';
const DEMO_VAULT_PATH = '/root/demo-vault';
// The archive's single top-level folder — every entry name is relative to it.
const ROOT_FOLDER_NAME = 'my-plugin-demo-vault-1.2.3';

// Paths inside the vault, as the walk reports them and as the archive names them under its root folder.
const APP_JSON_RELATIVE_PATH = `${EMPTY}.obsidian/app.json`;
const README_RELATIVE_PATH = 'README.md';
const NOTE_RELATIVE_PATH = 'Notes/Welcome.md';
const NOTE_CONTENT = '# Welcome\n\nA note the archiver only copies.\n';
const APP_JSON_PATH = join(DEMO_VAULT_PATH, APP_JSON_RELATIVE_PATH);
const README_PATH = join(DEMO_VAULT_PATH, README_RELATIVE_PATH);
const APP_JSON_ENTRY_NAME = join(ROOT_FOLDER_NAME, APP_JSON_RELATIVE_PATH);
const README_ENTRY_NAME = join(ROOT_FOLDER_NAME, README_RELATIVE_PATH);
const NOTE_ENTRY_NAME = join(ROOT_FOLDER_NAME, NOTE_RELATIVE_PATH);

const COMMITTED_README = '# My Plugin demo vault\n\nDemonstrates the plugin.\n';
const INJECTED_APP_JSON_SETTINGS = {
  defaultViewMode: 'preview',
  livePreview: false,
  newLinkFormat: 'relative',
  useMarkdownLinks: true
};

// The vault as committed: every file the walk finds, keyed by its path relative to the vault folder. A test
// that changes what the vault ships edits this map, and both the walk and the reads follow.
let committedVaultFiles: Map<string, string>;

function findArchiveEntryText(entryName: string): string | undefined {
  const entry = readArchive()[entryName];
  return entry ? Buffer.from(entry).toString('utf-8') : undefined;
}

function getArchiveEntryNames(): string[] {
  return Object.keys(readArchive());
}

function getArchiveEntryText(entryName: string): string {
  const content = findArchiveEntryText(entryName);
  if (content === undefined) {
    throw new Error(`The archive has no entry '${entryName}'.`);
  }

  return content;
}

// Reads back the archive the run wrote, so every assertion below is made against REAL bytes rather than
// against bookkeeping calls on a mocked archiver.
function readArchive(): Unzipped {
  const call = mockWriteFile.mock.calls.find(([path]) => path === ARCHIVE_PATH);
  if (!call) {
    throw new Error('The archive was never written.');
  }

  const [, data] = call;
  if (typeof data === 'string') {
    throw new TypeError('The archive was written as text rather than as bytes.');
  }

  return unzipSync(data);
}

function readInjectedAppJson(): unknown {
  return JSON.parse(getArchiveEntryText(APP_JSON_ENTRY_NAME));
}

// A `Dirent` as the recursive walk hands it over: the containing folder, the base name, and the one
// question the archiver asks of it.
function vaultDirent(relativePath: string, isFile: boolean): Dirent {
  const path = join(DEMO_VAULT_PATH, relativePath);
  return strictProxy<Dirent>({
    isFile: () => isFile,
    name: basename(path),
    parentPath: dirname(path)
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  committedVaultFiles = new Map([
    [APP_JSON_RELATIVE_PATH, JSON.stringify({ attachmentFolderPath: '_assets' })],
    [NOTE_RELATIVE_PATH, NOTE_CONTENT],
    [README_RELATIVE_PATH, COMMITTED_README]
  ]);
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockGetRootFolder.mockReturnValue('/package');
  mockCp.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockExistsSync.mockImplementation((path: string) => path === DEMO_VAULT_PATH || committedVaultFiles.has(relative(DEMO_VAULT_PATH, path)));
  // A folder dirent rides along with the files: the walk reports one for every folder in the vault, and
  // only files become archive entries.
  mockReaddir.mockImplementation(() =>
    Promise.resolve([
      vaultDirent('Notes', false),
      ...[...committedVaultFiles.keys()].map((relativePath) => vaultDirent(relativePath, true))
    ])
  );
  mockReadFile.mockImplementation((path: string, encoding?: string) => {
    const content = readCommittedFile(path);
    // The manifest and the committed `app.json` are read as text; the vault's files are read as bytes to be
    // archived verbatim.
    return Promise.resolve(encoding === undefined ? Buffer.from(content, 'utf-8') : content);
  });
  mockWriteFile.mockResolvedValue(undefined);
});

function readCommittedFile(path: string): string {
  if (path === MANIFEST_PATH) {
    return MANIFEST_CONTENT;
  }

  const content = committedVaultFiles.get(relative(DEMO_VAULT_PATH, path));
  if (content === undefined) {
    throw new Error(`Unexpected read of '${path}'.`);
  }

  return content;
}

describe('archivePluginDemoVault', () => {
  it('should return null and do nothing when demo-vault folder is absent', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await archivePluginDemoVault();
    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockCp).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  // The archive name carries no version — a release asset is already namespaced by its release tag, and a
  // name that changed every release is what broke the Community directory's finding overrides. The version
  // rides inside instead, on the single top-level folder the vault sits under.
  it('should install the built plugin, zip the vault under a versioned folder, and return the archive path', async () => {
    const result = await archivePluginDemoVault();

    expect(mockReadFile).toHaveBeenCalledWith(MANIFEST_PATH, 'utf-8');
    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/root/dist/build', `/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(getArchiveEntryNames()).toEqual([APP_JSON_ENTRY_NAME, NOTE_ENTRY_NAME, README_ENTRY_NAME]);
    expect(getArchiveEntryText(NOTE_ENTRY_NAME)).toBe(NOTE_CONTENT);
    expect(result).toBe(ARCHIVE_PATH);
  });

  // Git cannot track an empty folder, so a vault has none — and the extractor creates an entry's parents
  // whether or not the archive declared them. A folder entry would be weight with nothing to carry.
  it('should archive files only, never the folders the walk reports', async () => {
    await archivePluginDemoVault();

    expect(getArchiveEntryNames()).not.toContain(join(ROOT_FOLDER_NAME, 'Notes'));
    expect(getArchiveEntryNames()).not.toContain(`${join(ROOT_FOLDER_NAME, 'Notes')}/`);
  });

  it('should inject the shipped demo-vault-helper plugin into the vault', async () => {
    await archivePluginDemoVault();

    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/package/dist/demo-vault-helper', `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
  });

  // The one moment the demonstrated plugin's id is known for certain — it comes from that plugin's own
  // manifest. The opened vault can only offer plugin folders to count, and the bootstrap adds to those
  // itself, so it reads this marker instead of guessing.
  it('should record the demonstrated plugin id in the helper settings', async () => {
    await archivePluginDemoVault();

    expect(mockWriteFile).toHaveBeenCalledWith(
      `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper/data.json`,
      `${JSON.stringify({ demoedPluginId: 'my-plugin' }, null, 2)}\n`,
      'utf-8'
    );
  });

  // The settings belong to this package, so the archived copy carries them whatever the vault committed —
  // but the repo folder is never written to: `updateVersion` archives after it has already pushed, and
  // `app.json` is a tracked file, so an in-place write would leave a change behind a published release.
  it('should write the owned app.json settings into the archived vault, not into the repo folder', async () => {
    await archivePluginDemoVault();

    expect(readInjectedAppJson()).toEqual({
      ...INJECTED_APP_JSON_SETTINGS,
      attachmentFolderPath: '_assets'
    });
    expect(mockWriteFile).not.toHaveBeenCalledWith(APP_JSON_PATH, expect.anything(), expect.anything());
  });

  it('should add an app.json to a vault that commits none', async () => {
    committedVaultFiles.delete(APP_JSON_RELATIVE_PATH);
    await archivePluginDemoVault();

    expect(mockReadFile).not.toHaveBeenCalledWith(APP_JSON_PATH, 'utf-8');
    expect(readInjectedAppJson()).toEqual(INJECTED_APP_JSON_SETTINGS);
  });

  // The version follows the vault wherever it is unzipped to, so a folder that has been renamed or moved
  // still says which release it demonstrates. Written into the archive ENTRY for the same reason the
  // `app.json` settings are: the committed README is tracked, and `updateVersion` archives after the push.
  it('should name the version on the archived README heading, not in the repo copy', async () => {
    await archivePluginDemoVault();

    expect(getArchiveEntryText(README_ENTRY_NAME)).toBe('# My Plugin demo vault v1.2.3\n\nDemonstrates the plugin.\n');
    expect(mockWriteFile).not.toHaveBeenCalledWith(README_PATH, expect.anything(), expect.anything());
  });

  it('should leave a vault that ships no README alone', async () => {
    committedVaultFiles.delete(README_RELATIVE_PATH);
    await archivePluginDemoVault();

    expect(findArchiveEntryText(README_ENTRY_NAME)).toBeUndefined();
  });

  // The demo-vault coverage suite exempts `README.md` from its H1 check, so a README opening on something
  // else is a shape somebody chose, not a defect — and a release is the wrong moment to start failing on it.
  it('should leave a README that does not open on a heading alone', async () => {
    const readme = 'Demonstrates the plugin.\n\n# Not the opening heading\n';
    committedVaultFiles.set(README_RELATIVE_PATH, readme);
    await archivePluginDemoVault();

    expect(getArchiveEntryText(README_ENTRY_NAME)).toBe(readme);
  });

  // Reaching here means the coverage suite that already forbids this was skipped, so the committed value
  // is refused rather than silently discarded.
  it('should throw when the committed app.json sets an owned setting', async () => {
    committedVaultFiles.set(APP_JSON_RELATIVE_PATH, JSON.stringify({ livePreview: true, newLinkFormat: 'absolute' }));

    await expect(archivePluginDemoVault()).rejects.toThrow(
      `${APP_JSON_PATH} sets livePreview, newLinkFormat, which obsidian-dev-utils owns and writes into the archived demo vault. Settings it owns must not be committed.`
    );
    expect(mockWriteFile).not.toHaveBeenCalledWith(ARCHIVE_PATH, expect.anything());
  });

  it('should throw when the committed app.json cannot be parsed', async () => {
    committedVaultFiles.set(APP_JSON_RELATIVE_PATH, '{ not json');

    await expect(archivePluginDemoVault()).rejects.toThrow(`Could not parse ${APP_JSON_PATH}.`);
  });

  it('should throw when the obsidian-dev-utils package folder cannot be resolved', async () => {
    mockGetRootFolder.mockReturnValue(null);
    await expect(archivePluginDemoVault())
      .rejects.toThrow('Could not resolve the obsidian-dev-utils package folder to inject the demo-vault-helper plugin.');
  });
});
