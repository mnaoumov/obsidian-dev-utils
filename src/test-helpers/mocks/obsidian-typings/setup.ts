/**
 * @packageDocumentation
 *
 * Vitest setup file that imports obsidian-typings mock augmentations.
 * These augmentations patch mock prototypes to bridge obsidian-typings
 * and Obsidian API properties onto mock instances.
 */

import { mockCapacitorAdapter } from './src/obsidian/augmentations/CapacitorAdapter.ts';
import { mockFileSystemAdapter } from './src/obsidian/augmentations/FileSystemAdapter.ts';
import { mockSettingGroup } from './src/obsidian/augmentations/SettingGroup.ts';
import { mockTAbstractFile } from './src/obsidian/augmentations/TAbstractFile.ts';
import { mockVault } from './src/obsidian/augmentations/Vault.ts';

export function setupObsidianTypingsMocks(): void {
  mockCapacitorAdapter();
  mockFileSystemAdapter();
  mockSettingGroup();
  mockTAbstractFile();
  mockVault();
}
