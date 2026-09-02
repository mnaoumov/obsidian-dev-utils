import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResolvePathFromRootSafeParams } from './root.ts';

import { EMPTY } from '../string.ts';
import { archivePluginDemoVault } from './demo-vault.ts';

const {
  mockAddFile,
  mockAddLocalFolder,
  mockCp,
  mockExistsSync,
  mockGetEntry,
  mockGetRootFolder,
  mockMkdir,
  mockReadFile,
  mockResolvePathFromRootSafe,
  mockUpdateFile,
  mockWriteFile,
  mockWriteZipPromise
} = vi.hoisted(() => ({
  mockAddFile: vi.fn(),
  mockAddLocalFolder: vi.fn(),
  mockCp: vi.fn(),
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockGetEntry: vi.fn<(entryName: string) => null | object>(),
  mockGetRootFolder: vi.fn<(cwd?: string) => null | string>(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn<(path: string, encoding: string) => Promise<string>>(),
  mockResolvePathFromRootSafe: vi.fn<(params: ResolvePathFromRootSafeParams) => string>(),
  mockUpdateFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockWriteZipPromise: vi.fn()
}));

vi.mock('adm-zip', () => ({
  default: class {
    public addFile = mockAddFile;
    public addLocalFolder = mockAddLocalFolder;
    public getEntry = mockGetEntry;
    public updateFile = mockUpdateFile;
    public writeZipPromise = mockWriteZipPromise;
  }
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
    readFile: mockReadFile,
    writeFile: mockWriteFile
  };
});

vi.mock('./root.ts', () => ({
  getRootFolder: mockGetRootFolder,
  resolvePathFromRootSafe: mockResolvePathFromRootSafe
}));

const MANIFEST_PATH = '/root/manifest.json';
const ARCHIVE_PATH = '/root/dist/build/my-plugin-demo-vault.zip';
// The archive's single top-level folder — every entry name is relative to it.
const ROOT_FOLDER_NAME = 'my-plugin-demo-vault-1.2.3';
const APP_JSON_PATH = `/root/demo-vault/${EMPTY}.obsidian/app.json`;
const APP_JSON_ENTRY_NAME = `${ROOT_FOLDER_NAME}/${EMPTY}.obsidian/app.json`;
const README_PATH = '/root/demo-vault/README.md';
const README_ENTRY_NAME = `${ROOT_FOLDER_NAME}/README.md`;
const COMMITTED_README = '# My Plugin demo vault\n\nDemonstrates the plugin.\n';
const INJECTED_APP_JSON_SETTINGS = {
  defaultViewMode: 'preview',
  livePreview: false,
  newLinkFormat: 'relative',
  useMarkdownLinks: true
};

// A zip entry as the archiver sees it — opaque apart from the name, which is what the assertions match on.
interface ZipEntryStub {
  readonly entryName: string;
  getData?(): Buffer;
}

// The vault's own settings, carrying none of the ones this package injects — the state the demo-vault
// Coverage suite enforces on every consumer.
let committedAppJson: string;

// The vault's committed `README.md`, or `null` for a vault that ships none.
let committedReadme: null | string;

// Whether the vault commits an `app.json` at all — a vault with nothing else to configure commits none.
let hasCommittedAppJsonEntry: boolean;

function findUpdatedContent(entryName: string): Buffer | undefined {
  const call = (mockUpdateFile.mock.calls as [ZipEntryStub, Buffer][]).find(([entry]) => entry.entryName === entryName);
  return call?.[1];
}

function getUpdatedContent(entryName: string): Buffer {
  const content = findUpdatedContent(entryName);
  if (!content) {
    throw new Error(`The archive entry '${entryName}' was never updated.`);
  }

  return content;
}

function readInjectedAppJson(content: Buffer): unknown {
  return JSON.parse(content.toString('utf-8'));
}

beforeEach(() => {
  vi.resetAllMocks();
  committedAppJson = JSON.stringify({ attachmentFolderPath: '_assets' });
  committedReadme = COMMITTED_README;
  hasCommittedAppJsonEntry = true;
  mockResolvePathFromRootSafe.mockImplementation((params: ResolvePathFromRootSafeParams) => `/root/${params.path}`);
  mockGetRootFolder.mockReturnValue('/package');
  mockCp.mockResolvedValue(undefined);
  mockGetEntry.mockImplementation((entryName: string) => {
    if (entryName === APP_JSON_ENTRY_NAME) {
      return hasCommittedAppJsonEntry ? { entryName } : null;
    }

    if (entryName === README_ENTRY_NAME && committedReadme !== null) {
      const readme = committedReadme;
      return {
        entryName,
        getData: (): Buffer => Buffer.from(readme, 'utf-8')
      };
    }

    return null;
  });
  mockMkdir.mockResolvedValue(undefined);
  mockReadFile.mockImplementation((path: string) => Promise.resolve(path === MANIFEST_PATH ? JSON.stringify({ id: 'my-plugin', version: '1.2.3' }) : committedAppJson));
  mockWriteFile.mockResolvedValue(undefined);
  mockWriteZipPromise.mockResolvedValue(true);
});

describe('archivePluginDemoVault', () => {
  it('should return null and do nothing when demo-vault folder is absent', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await archivePluginDemoVault();
    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockCp).not.toHaveBeenCalled();
    expect(mockWriteZipPromise).not.toHaveBeenCalled();
  });

  // The archive name carries no version — a release asset is already namespaced by its release tag, and a
  // Name that changed every release is what broke the Community directory's finding overrides. The version
  // Rides inside instead, on the single top-level folder the vault sits under.
  it('should install the built plugin, zip the vault under a versioned folder, and return the archive path', async () => {
    mockExistsSync.mockReturnValue(true);
    const result = await archivePluginDemoVault();

    expect(mockReadFile).toHaveBeenCalledWith('/root/manifest.json', 'utf-8');
    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/root/dist/build', `/root/demo-vault/${EMPTY}.obsidian/plugins/my-plugin`, { recursive: true });
    expect(mockAddLocalFolder).toHaveBeenCalledWith('/root/demo-vault', ROOT_FOLDER_NAME);
    expect(mockWriteZipPromise).toHaveBeenCalledWith(ARCHIVE_PATH);
    expect(result).toBe(ARCHIVE_PATH);
  });

  it('should inject the shipped demo-vault-helper plugin into the vault', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(mockMkdir).toHaveBeenCalledWith(`/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
    expect(mockCp).toHaveBeenCalledWith('/package/dist/demo-vault-helper', `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper`, { recursive: true });
  });

  // The one moment the demonstrated plugin's id is known for certain — it comes from that plugin's own
  // Manifest. The opened vault can only offer plugin folders to count, and the bootstrap adds to those
  // Itself, so it reads this marker instead of guessing.
  it('should record the demonstrated plugin id in the helper settings', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(mockWriteFile).toHaveBeenCalledWith(
      `/root/demo-vault/${EMPTY}.obsidian/plugins/demo-vault-helper/data.json`,
      `${JSON.stringify({ demoedPluginId: 'my-plugin' }, null, 2)}\n`,
      'utf-8'
    );
  });

  // The settings belong to this package, so the archived copy carries them whatever the vault committed —
  // But the repo folder is never written to: `updateVersion` archives after it has already pushed, and
  // `app.json` is a tracked file, so an in-place write would leave a change behind a published release.
  it('should write the owned app.json settings into the archived vault, not into the repo folder', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(readInjectedAppJson(getUpdatedContent(APP_JSON_ENTRY_NAME))).toEqual({
      ...INJECTED_APP_JSON_SETTINGS,
      attachmentFolderPath: '_assets'
    });
    expect(mockAddFile).not.toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).not.toHaveBeenCalledWith(APP_JSON_PATH, expect.anything(), expect.anything());
  });

  it('should add an app.json to a vault that commits none', async () => {
    mockExistsSync.mockImplementation((path: string) => path !== APP_JSON_PATH);
    hasCommittedAppJsonEntry = false;
    await archivePluginDemoVault();

    expect(mockReadFile).not.toHaveBeenCalledWith(APP_JSON_PATH, 'utf-8');
    expect(findUpdatedContent(APP_JSON_ENTRY_NAME)).toBeUndefined();
    expect(mockAddFile).toHaveBeenCalledTimes(1);
    const [entryName, content] = mockAddFile.mock.calls[0] as [string, Buffer];
    expect(entryName).toBe(APP_JSON_ENTRY_NAME);
    expect(readInjectedAppJson(content)).toEqual(INJECTED_APP_JSON_SETTINGS);
  });

  // The version follows the vault wherever it is unzipped to, so a folder that has been renamed or moved
  // Still says which release it demonstrates. Written into the archive ENTRY for the same reason the
  // `app.json` settings are: the committed README is tracked, and `updateVersion` archives after the push.
  it('should name the version on the archived README heading, not in the repo copy', async () => {
    mockExistsSync.mockReturnValue(true);
    await archivePluginDemoVault();

    expect(getUpdatedContent(README_ENTRY_NAME).toString('utf-8')).toBe('# My Plugin demo vault v1.2.3\n\nDemonstrates the plugin.\n');
    expect(mockWriteFile).not.toHaveBeenCalledWith(README_PATH, expect.anything(), expect.anything());
  });

  it('should leave a vault that ships no README alone', async () => {
    mockExistsSync.mockReturnValue(true);
    committedReadme = null;
    await archivePluginDemoVault();

    expect(findUpdatedContent(README_ENTRY_NAME)).toBeUndefined();
  });

  // The demo-vault coverage suite exempts `README.md` from its H1 check, so a README opening on something
  // Else is a shape somebody chose, not a defect — and a release is the wrong moment to start failing on it.
  it('should leave a README that does not open on a heading alone', async () => {
    mockExistsSync.mockReturnValue(true);
    committedReadme = 'Demonstrates the plugin.\n\n# Not the opening heading\n';
    await archivePluginDemoVault();

    expect(findUpdatedContent(README_ENTRY_NAME)).toBeUndefined();
  });

  // Reaching here means the coverage suite that already forbids this was skipped, so the committed value
  // Is refused rather than silently discarded.
  it('should throw when the committed app.json sets an owned setting', async () => {
    mockExistsSync.mockReturnValue(true);
    committedAppJson = JSON.stringify({ livePreview: true, newLinkFormat: 'absolute' });

    await expect(archivePluginDemoVault()).rejects.toThrow(
      `${APP_JSON_PATH} sets livePreview, newLinkFormat, which obsidian-dev-utils owns and writes into the archived demo vault. Settings it owns must not be committed.`
    );
    expect(mockWriteZipPromise).not.toHaveBeenCalled();
  });

  it('should throw when the committed app.json cannot be parsed', async () => {
    mockExistsSync.mockReturnValue(true);
    committedAppJson = '{ not json';

    await expect(archivePluginDemoVault()).rejects.toThrow(`Could not parse ${APP_JSON_PATH}.`);
  });

  it('should throw when the obsidian-dev-utils package folder cannot be resolved', async () => {
    mockExistsSync.mockReturnValue(true);
    mockGetRootFolder.mockReturnValue(null);
    await expect(archivePluginDemoVault())
      .rejects.toThrow('Could not resolve the obsidian-dev-utils package folder to inject the demo-vault-helper plugin.');
  });
});
