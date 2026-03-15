/**
 * @packageDocumentation
 *
 * Mock vault helpers for test files. Provides utilities to add and remove
 * abstract files from the mock vault's internal file map.
 */

import type {
  TAbstractFile,
  Vault as ObsidianVault
} from 'obsidian';

/**
 * Removes an abstract file from the mock vault's internal file map.
 *
 * @param vault - The mock vault.
 * @param path - The path key to delete.
 */
export function deleteVaultAbstractFile(vault: ObsidianVault, path: string): void {
  const fileMap = getFileMap(vault);
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Simple in-memory map for tests.
  delete fileMap[path];
}

/**
 * Adds an abstract file to the mock vault's internal file map.
 *
 * @param vault - The mock vault.
 * @param path - The path key.
 * @param file - The abstract file to store.
 */
export function setVaultAbstractFile(vault: ObsidianVault, path: string, file: TAbstractFile): void {
  const fileMap = getFileMap(vault);
  fileMap[path] = file;
  (file as unknown as { deleted__: boolean }).deleted__ = false;
  if (path !== '/' && path !== '') {
    const lastSlash = path.lastIndexOf('/');
    const parentKey = lastSlash > 0 ? path.slice(0, lastSlash) : '/';
    const parentFile = fileMap[parentKey];
    if (parentFile && 'children' in parentFile) {
      (file as unknown as { parent: TAbstractFile }).parent = parentFile;
      (parentFile as unknown as { children: TAbstractFile[] }).children.push(file);
    }
  }
}

/**
 * Internal accessor for the mock vault's file map.
 *
 * @param vault - The mock vault.
 * @returns The file map record.
 */
function getFileMap(vault: ObsidianVault): Record<string, TAbstractFile> {
  return (vault as unknown as { fileMap__: Record<string, TAbstractFile> }).fileMap__;
}
