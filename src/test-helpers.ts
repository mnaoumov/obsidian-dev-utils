/**
 * @packageDocumentation
 *
 * Test helper utilities shared across test files.
 */

import type {
  App as ObsidianApp,
  TAbstractFile,
  TFile as ObsidianTFile,
  TFolder as ObsidianTFolder,
  Vault as ObsidianVault
} from 'obsidian';
import type { MockInstance } from 'vitest';

import {
  App,
  TFile,
  TFolder
} from 'obsidian';
import { vi } from 'vitest';

/**
 * Spies on a method and replaces it with an implementation that receives
 * `originalImplementation` as its first argument, followed by the real call
 * arguments. The caller is responsible for forwarding `this` via `.call(this, ...)`.
 *
 * @param obj - The object whose method to spy on.
 * @param method - The method name.
 * @param impl - `function(originalImplementation, ...args)`.
 * @returns The spy instance.
 */
const savedOriginals = new WeakMap<object, Map<string, unknown>>();

/**
 * Parameters for creating a mock Obsidian App instance.
 */
export interface MockAppParams {
  /**
   * Files to create in the mock vault.
   */
  files?: MockFileEntry[];

  /**
   * Folder paths to create in the mock vault.
   */
  folders?: string[];
}

/**
 * A file entry for mock vault creation.
 */
export interface MockFileEntry {
  /**
   * Optional file content.
   */
  content?: string;

  /**
   * File path within the vault.
   */
  path: string;
}

/**
 * Internal type for accessing obsidian-test-mocks TFile/TFolder.create__ factory.
 */
interface MockAbstractFileFactory<T> {
  /**
   * Creates a mock instance.
   *
   * @param vault - The vault to associate with.
   * @param path - The file/folder path.
   * @returns A mock instance.
   */
  create__(vault: ObsidianVault, path: string): T;
}

/**
 * Internal type for accessing obsidian-test-mocks App.createConfigured__.
 */
interface MockAppFactory {
  /**
   * Creates a configured App mock.
   *
   * @param params - Configuration with file map.
   * @returns A Promise resolving to a mock App.
   */
  createConfigured__(params: MockAppFactoryParams): Promise<ObsidianApp>;
}

/**
 * Parameter type for App.createConfigured__.
 */
interface MockAppFactoryParams {
  /**
   * Map of file paths to content strings.
   */
  files: Record<string, string>;
}

/**
 * Creates a mock Obsidian App instance using obsidian-test-mocks.
 *
 * @param params - Configuration for files and folders.
 * @returns A Promise resolving to a mock App.
 */
export async function createMockApp(params: MockAppParams = {}): Promise<ObsidianApp> {
  const files: Record<string, string> = {};

  for (const folderPath of params.folders ?? []) {
    files[`${folderPath}/`] = '';
  }

  for (const fileOpt of params.files ?? []) {
    files[fileOpt.path] = fileOpt.content ?? '';
  }

  const app = await (App as unknown as MockAppFactory).createConfigured__({ files });
  return app;
}

/**
 * Creates a strictly-typed mock object from a partial implementation.
 * Unlike `castTo<T>()`, this uses a `Proxy` to throw an error if any
 * unmocked property is accessed, preventing silent `undefined` returns
 * that don't match the actual type.
 *
 * Nested plain objects are recursively proxied for deep protection.
 * Functions (including `vi.fn()`), arrays, class instances, and primitives
 * are passed through without proxying.
 *
 * @param partial - A partial object containing only the mocked members.
 * @returns A proxy typed as `T` that throws on unmocked property access.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T provides return type inference at call sites.
export function createMockOf<T>(partial: unknown): T {
  if (!isPlainObject(partial)) {
    return partial as T;
  }

  const proxiedChildren = new Map<string | symbol, unknown>();

  return new Proxy(partial, {
    get(target, prop, receiver): unknown {
      if (!(prop in target) && typeof prop !== 'symbol') {
        // 'then' must return undefined so that Promise.resolve() / await
        // Can detect non-thenable objects without throwing.
        if (prop === 'then') {
          return undefined;
        }
        throw new Error(`Unmocked property "${prop}" was accessed on mock object`);
      }

      if (proxiedChildren.has(prop)) {
        return proxiedChildren.get(prop);
      }

      const value = Reflect.get(target, prop, receiver);
      if (isPlainObject(value)) {
        const result = createMockOf(value);
        proxiedChildren.set(prop, result);
        return result;
      }
      return value;
    }
  }) as T;
}

/**
 * Creates a mock TFile instance via obsidian-test-mocks factory.
 *
 * @param app - The mock App instance.
 * @param path - The file path.
 * @returns A mock TFile.
 */
export function createTFileInstance(app: ObsidianApp, path: string): ObsidianTFile {
  return (TFile as unknown as MockAbstractFileFactory<ObsidianTFile>).create__(app.vault, path);
}

/**
 * Creates a mock TFolder instance via obsidian-test-mocks factory.
 *
 * @param app - The mock App instance.
 * @param path - The folder path.
 * @returns A mock TFolder.
 */
export function createTFolderInstance(app: ObsidianApp, path: string): ObsidianTFolder {
  return (TFolder as unknown as MockAbstractFileFactory<ObsidianTFolder>).create__(app.vault, path);
}

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
 * Spies on a method and replaces it with an implementation that receives
 * `originalImplementation` as its first argument, followed by the real call arguments.
 *
 * @param obj - The object whose method to spy on.
 * @param method - The method name.
 * @param impl - Replacement function receiving the original implementation and call args.
 * @returns The spy instance.
 */
export function mockImplementation<
  T extends object,
  K extends keyof T & string,
  F extends (...args: unknown[]) => unknown = T[K] extends (...args: unknown[]) => unknown ? T[K] : never
>(
  obj: T,
  method: K,
  impl: (this: T, originalImplementation: F, ...args: Parameters<F>) => ReturnType<F>
): MockInstance {
  let map = savedOriginals.get(obj);
  if (!map) {
    map = new Map();
    savedOriginals.set(obj, map);
  }

  const current = obj[method];
  if (!map.has(method) && !vi.isMockFunction(current)) {
    map.set(method, current);
  }

  const originalImplementation = map.get(method) as F;

  return vi.spyOn(obj, method as never).mockImplementation(function mockImpl(this: unknown, ...args: unknown[]): unknown {
    return impl.call(this as T, originalImplementation, ...(args as Parameters<F>));
  });
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

/**
 * Checks if a value is a plain object (not a class instance, array, null, etc.).
 *
 * @param value - The value to check.
 * @returns Whether the value is a plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
