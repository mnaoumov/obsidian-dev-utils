/**
 * @file
 *
 * Integration tests for {@link RmdirGuardComponent} against a real Obsidian instance.
 *
 * The unit tests drive `obsidian-test-mocks`' in-memory adapter, which is our own reimplementation of
 * `rmdir` — so they can only prove the component behaves as designed against a model of the adapter. The
 * question this suite exists for is what the REAL adapter does, because that is what makes the guard
 * necessary in the first place.
 *
 * The first case is the negative control that pins the premise: unguarded, the desktop
 * `FileSystemAdapter` forwards `recursive` to `fs.promises.rm`, which throws `ERR_FS_EISDIR` for ANY
 * directory when `recursive` is `false` — even an empty one. So the native non-recursive call never
 * succeeds on desktop, and (per the mobile `CapacitorAdapter`, which does not accept the argument at all)
 * always removes the whole subtree on mobile. If Obsidian ever fixes `rmdir`, that case goes red and tells
 * us this component is obsolete.
 *
 * Assertions read the vault ADAPTER (`exists`), not the vault file-tree: these folders are created through
 * the adapter, and the tree's reflection of them arrives asynchronously via Obsidian's file watcher.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface GuardedResult {
  readonly doesChildSurviveRefusal: boolean;
  readonly doesFolderSurviveRefusal: boolean;
  readonly isEmptyFolderGone: boolean;
  readonly isRecursivelyRemovedFolderGone: boolean;
  readonly refusalErrorCode: string;
}

interface UnguardedResult {
  readonly nativeEmptyFolderErrorCode: string;
}

// Spelled out rather than imported from the component: this project runs in a `node` environment with no
// `obsidian` alias, so importing the module (which reaches `obsidian` through `../vault.ts`) fails to resolve.
const NOT_EMPTY_DIRECTORY_ERROR_CODE = 'ENOTEMPTY';

describe('RmdirGuardComponent', () => {
  it('should be needed: the native non-recursive rmdir refuses even an empty folder', async () => {
    const result = await evalInObsidian<Record<string, never>, UnguardedResult>({
      async callback({ app }) {
        const adapter = app.vault.adapter;
        const rootPath = 'rmdir-guard-integration-unguarded';
        const emptyFolderPath = `${rootPath}/empty`;

        await adapter.mkdir(rootPath);
        await adapter.mkdir(emptyFolderPath);

        try {
          return {
            nativeEmptyFolderErrorCode: await captureErrorCode(async () => {
              await adapter.rmdir(emptyFolderPath, false);
            })
          };
        } finally {
          await adapter.rmdir(rootPath, true);
        }

        async function captureErrorCode(operation: () => Promise<void>): Promise<string> {
          try {
            await operation();
            return '';
          } catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error) {
              return String(error.code);
            }
            return String(error);
          }
        }
      }
    });

    expect(result.nativeEmptyFolderErrorCode).toBe('ERR_FS_EISDIR');
  });

  it('should refuse a non-recursive removal of a non-empty folder while still allowing the empty and recursive cases', async () => {
    const result = await evalInObsidian<Record<string, never>, GuardedResult>({
      async callback({ app, lib: { RmdirGuardComponent } }) {
        const adapter = app.vault.adapter;
        const rootPath = 'rmdir-guard-integration-guarded';
        const emptyFolderPath = `${rootPath}/empty`;
        const nonEmptyFolderPath = `${rootPath}/non-empty`;
        const childPath = `${nonEmptyFolderPath}/child.md`;
        const recursiveFolderPath = `${rootPath}/recursive`;

        await adapter.mkdir(rootPath);
        await adapter.mkdir(emptyFolderPath);
        await adapter.mkdir(nonEmptyFolderPath);
        await adapter.write(childPath, 'CHILD');
        await adapter.mkdir(recursiveFolderPath);
        await adapter.write(`${recursiveFolderPath}/child.md`, 'CHILD');

        const component = new RmdirGuardComponent(app);
        component.load();

        try {
          const refusalErrorCode = await captureErrorCode(async () => {
            await adapter.rmdir(nonEmptyFolderPath, false);
          });
          const doesFolderSurviveRefusal = await adapter.exists(nonEmptyFolderPath);
          const doesChildSurviveRefusal = await adapter.exists(childPath);

          // The native call throws `ERR_FS_EISDIR` here; the guard proves the folder empty and forwards
          // Recursively, so this is the case the guard FIXES rather than merely blocks.
          await adapter.rmdir(emptyFolderPath, false);
          const isEmptyFolderGone = !await adapter.exists(emptyFolderPath);

          await adapter.rmdir(recursiveFolderPath, true);
          const isRecursivelyRemovedFolderGone = !await adapter.exists(recursiveFolderPath);

          return {
            doesChildSurviveRefusal,
            doesFolderSurviveRefusal,
            isEmptyFolderGone,
            isRecursivelyRemovedFolderGone,
            refusalErrorCode
          };
        } finally {
          component.unload();
          await adapter.rmdir(rootPath, true);
        }

        async function captureErrorCode(operation: () => Promise<void>): Promise<string> {
          try {
            await operation();
            return '';
          } catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error) {
              return String(error.code);
            }
            return String(error);
          }
        }
      }
    });

    expect(result.refusalErrorCode).toBe(NOT_EMPTY_DIRECTORY_ERROR_CODE);
    expect(result.doesFolderSurviveRefusal).toBe(true);
    expect(result.doesChildSurviveRefusal).toBe(true);
    expect(result.isEmptyFolderGone).toBe(true);
    expect(result.isRecursivelyRemovedFolderGone).toBe(true);
  });
});
