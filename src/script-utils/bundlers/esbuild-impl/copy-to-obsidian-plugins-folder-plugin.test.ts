import type {
  BuildResult,
  PluginBuild
} from 'esbuild';

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../../test-helpers/mock-implementation.ts';
import { assertNonNullable } from '../../../type-guards.ts';
import { copyToObsidianPluginsFolderPlugin } from './copy-to-obsidian-plugins-folder-plugin.ts';

interface EvalInObsidianCall {
  vaultPath: string;
}

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('node:fs/promises', () => ({
  cp: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('[]'),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

const { mockEvalInObsidian } = vi.hoisted(() => ({
  mockEvalInObsidian: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('obsidian-integration-testing', () => ({
  evalInObsidian: mockEvalInObsidian
}));

// eslint-disable-next-line obsidianmd/hardcoded-config-path -- Testing that .obsidian is stripped from the vault path.
const OBSIDIAN_CONFIG_FOLDER = 'f:/dev/ObsidianVaults/Test/.obsidian';
const EXPECTED_VAULT_ROOT = 'f:/dev/ObsidianVaults/Test';

describe('copyToObsidianPluginsFolderPlugin', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should pass vault root path (not config folder) to evalInObsidian', async () => {
    const plugin = copyToObsidianPluginsFolderPlugin(false, 'dist', OBSIDIAN_CONFIG_FOLDER, 'my-plugin');

    let onEndCallback: ((result: BuildResult) => Promise<void> | void) | undefined;
    const mockBuild = strictProxy<PluginBuild>({
      onEnd(callback: (result: BuildResult) => Promise<void> | void): void {
        onEndCallback = callback;
      }
    });

    await plugin.setup(mockBuild);
    assertNonNullable(onEndCallback);
    await onEndCallback({
      errors: [],
      mangleCache: {},
      metafile: { inputs: {}, outputs: {} },
      outputFiles: [],
      warnings: []
    });

    expect(mockEvalInObsidian).toHaveBeenCalledTimes(2);

    for (const call of mockEvalInObsidian.mock.calls as EvalInObsidianCall[][]) {
      expect(call[0]?.vaultPath).toBe(EXPECTED_VAULT_ROOT);
    }
  });
});
