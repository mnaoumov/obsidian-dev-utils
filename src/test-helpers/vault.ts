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

import { ensureGenericObject } from '../type-guards.ts';

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
  ensureGenericObject(file)['deleted__'] = false;
  if (path !== '/' && path !== '') {
    const lastSlash = path.lastIndexOf('/');
    const parentKey = lastSlash > 0 ? path.slice(0, lastSlash) : '/';
    const parentFile = fileMap[parentKey];
    if (parentFile && 'children' in parentFile) {
      (ensureGenericObject(file) as Record<string, unknown>)['parent'] = parentFile;
      (ensureGenericObject(parentFile).children as TAbstractFile[]).push(file);
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
  return ensureGenericObject(vault)['fileMap__'] as Record<string, TAbstractFile>;
}
