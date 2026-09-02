import {
  describe,
  expect,
  it
} from 'vitest';

import {
  getDemoVaultArchiveFileName,
  getDemoVaultFolderName
} from './demo-vault-naming.ts';

const PLUGIN_ID = 'my-plugin';
const VERSION = '1.2.3';

describe('getDemoVaultArchiveFileName', () => {
  // The version is deliberately absent: a release asset is already namespaced by its release tag, and a
  // Name that changed every release is what broke the Community directory's finding overrides, whose
  // Fingerprint includes it.
  it('should name the archive by plugin id alone', () => {
    expect(getDemoVaultArchiveFileName(PLUGIN_ID)).toBe('my-plugin-demo-vault.zip');
  });
});

describe('getDemoVaultFolderName', () => {
  it('should name the folder by plugin id and version', () => {
    expect(getDemoVaultFolderName({
      pluginId: PLUGIN_ID,
      version: VERSION
    })).toBe('my-plugin-demo-vault-1.2.3');
  });

  // Two plugins' vaults never collide in a Downloads folder, and neither do two versions of one plugin's —
  // Which is the whole of what the version in the old archive name was there to buy.
  it('should distinguish both other plugins and other versions', () => {
    const folderName = getDemoVaultFolderName({
      pluginId: PLUGIN_ID,
      version: VERSION
    });

    expect(folderName).not.toBe(getDemoVaultFolderName({
      pluginId: 'other-plugin',
      version: VERSION
    }));
    expect(folderName).not.toBe(getDemoVaultFolderName({
      pluginId: PLUGIN_ID,
      version: '1.2.4'
    }));
  });
});
