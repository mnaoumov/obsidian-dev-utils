import {
  describe,
  expect,
  it
} from 'vitest';

import type { DemoVaultAppJson } from './demo-vault-app-json.ts';

import { EMPTY } from '../string.ts';
import {
  buildArchivedDemoVaultAppJsonContent,
  DEMO_VAULT_APP_JSON_SETTINGS,
  findOwnedDemoVaultAppJsonSettings,
  parseDemoVaultAppJson
} from './demo-vault-app-json.ts';

const APP_JSON_PATH = `/root/demo-vault/${EMPTY}.obsidian/app.json`;

describe('DEMO_VAULT_APP_JSON_SETTINGS', () => {
  it('pins the reader-facing view mode and the link form written on creation', () => {
    expect(DEMO_VAULT_APP_JSON_SETTINGS).toEqual({
      defaultViewMode: 'preview',
      livePreview: false,
      newLinkFormat: 'relative',
      useMarkdownLinks: true
    });
  });
});

describe('parseDemoVaultAppJson', () => {
  it('returns an empty object when the vault commits no app.json', () => {
    expect(parseDemoVaultAppJson({ content: null, path: APP_JSON_PATH })).toEqual({});
  });

  it('parses committed settings', () => {
    expect(parseDemoVaultAppJson({ content: '{ "attachmentFolderPath": "_assets" }', path: APP_JSON_PATH }))
      .toEqual({ attachmentFolderPath: '_assets' });
  });

  it('names the file when the content does not parse', () => {
    expect(() => parseDemoVaultAppJson({ content: '{ not json', path: APP_JSON_PATH }))
      .toThrow(`Could not parse ${APP_JSON_PATH}.`);
  });
});

describe('findOwnedDemoVaultAppJsonSettings', () => {
  it('reports nothing for a vault that commits only its own settings', () => {
    expect(findOwnedDemoVaultAppJsonSettings({ appJson: { attachmentFolderPath: '_assets' } })).toEqual([]);
  });

  it('reports nothing for an empty app.json', () => {
    expect(findOwnedDemoVaultAppJsonSettings({ appJson: {} })).toEqual([]);
  });

  it('reports an owned setting even when it carries the value this package would write', () => {
    expect(findOwnedDemoVaultAppJsonSettings({ appJson: { defaultViewMode: 'preview' } })).toEqual(['defaultViewMode']);
  });

  it('reports every owned setting the vault commits, in declaration order', () => {
    const appJson: DemoVaultAppJson = {
      attachmentFolderPath: '_assets',

      livePreview: true,
      useMarkdownLinks: false
    };
    expect(findOwnedDemoVaultAppJsonSettings({ appJson })).toEqual(['livePreview', 'useMarkdownLinks']);
  });
});

describe('buildArchivedDemoVaultAppJsonContent', () => {
  it('writes the owned settings into a vault that commits no app.json', () => {
    const content = buildArchivedDemoVaultAppJsonContent({ appJson: {} });
    expect(JSON.parse(content)).toEqual(DEMO_VAULT_APP_JSON_SETTINGS);
  });

  it('keeps the settings the vault does own', () => {
    const content = buildArchivedDemoVaultAppJsonContent({ appJson: { attachmentFolderPath: '_assets' } });
    expect(JSON.parse(content)).toEqual({
      ...DEMO_VAULT_APP_JSON_SETTINGS,
      attachmentFolderPath: '_assets'
    });
  });

  // The archive is the copy a reader opens, so it is written correctly whatever the committed file says —
  // Refusing a committed owned setting is the archiver's job, not this builder's.
  it('overrides a committed owned setting', () => {
    const content = buildArchivedDemoVaultAppJsonContent({ appJson: { livePreview: true } });
    expect((JSON.parse(content) as DemoVaultAppJson)['livePreview']).toBe(false);
  });

  it('formats the file the way Obsidian writes it', () => {
    const content = buildArchivedDemoVaultAppJsonContent({ appJson: {} });
    expect(content).toBe(`{
  "defaultViewMode": "preview",
  "livePreview": false,
  "newLinkFormat": "relative",
  "useMarkdownLinks": true
}
`);
  });
});
