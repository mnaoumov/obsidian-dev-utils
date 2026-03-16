/**
 * @packageDocumentation
 *
 * Vitest setup file that imports obsidian-typings mock augmentations.
 * These augmentations hook into obsidian-test-mocks constructors to
 * bridge obsidian-typings properties onto mock instances.
 */

// eslint-disable-next-line import-x/no-unassigned-import -- Side-effect imports that register mock augmentations.
import './src/obsidian/augmentations/SettingGroup.ts';
// eslint-disable-next-line import-x/no-unassigned-import -- Side-effect imports that register mock augmentations.
import './src/obsidian/augmentations/Vault.ts';
