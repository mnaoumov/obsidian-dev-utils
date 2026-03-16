/**
 * @packageDocumentation
 *
 * Vitest setup file that imports obsidian-typings mock augmentations.
 * These augmentations hook into obsidian-test-mocks constructors to
 * bridge obsidian-typings properties onto mock instances.
 */

import { mockSettingGroup } from './src/obsidian/augmentations/SettingGroup.ts';
import { mockVault } from './src/obsidian/augmentations/Vault.ts';

mockSettingGroup();
mockVault();
