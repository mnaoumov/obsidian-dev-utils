/**
 * @packageDocumentation
 *
 * Mock vault helpers for test files. Thin wrappers around
 * `obsidian-test-mocks` Vault methods for use with real obsidian types.
 */

import type {
  TAbstractFile,
  Vault as ObsidianVault
} from 'obsidian';

import {
  TAbstractFile as MockTAbstractFile,
  Vault as MockVault
} from 'obsidian-test-mocks/obsidian';

import { castTo } from '../object-utils.ts';

/**
 * Removes an abstract file from the mock vault's internal file map.
 *
 * @param vault - The mock vault.
 * @param path - The path key to delete.
 */
export function deleteVaultAbstractFile(vault: ObsidianVault, path: string): void {
  castTo<MockVault>(vault).deleteVaultAbstractFile__(path);
}

/**
 * Adds an abstract file to the mock vault's internal file map.
 *
 * @param vault - The mock vault.
 * @param path - The path key.
 * @param file - The abstract file to store.
 */
export function setVaultAbstractFile(vault: ObsidianVault, path: string, file: TAbstractFile): void {
  castTo<MockVault>(vault).setVaultAbstractFile__(path, castTo<MockTAbstractFile>(file));
}
