/**
 * @file
 *
 * Tests for {@link ObsidianPluginRepoPaths}.
 */

import {
  describe,
  expect,
  it
} from 'vitest';

import { ObsidianPluginRepoPaths } from './obsidian-plugin-repo-paths.ts';

describe('ObsidianPluginRepoPaths', () => {
  it('should have expected path values', () => {
    expect(ObsidianPluginRepoPaths.MainJs).toBe('main.js');
    expect(ObsidianPluginRepoPaths.ManifestJson).toBe('manifest.json');
    expect(ObsidianPluginRepoPaths.PackageJson).toBe('package.json');
    expect(ObsidianPluginRepoPaths.Src).toBe('src');
    expect(ObsidianPluginRepoPaths.Dist).toBe('dist');
  });
});
