/**
 * @file
 *
 * Tests for {@link FolderCommandHandler}.
 */

import type {
  App as AppOriginal,
  TFolder as TFolderOriginal,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

import {
  App,
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';
import type { ActiveFileProvider } from './command-handler.ts';

import { castTo } from '../../object-utils.ts';
import { FolderCommandHandler } from './folder-command-handler.ts';

let app: AppOriginal;

class TestFolderHandler extends FolderCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  protected override canExecuteFolder(_folder: TFolderOriginal): boolean {
    return this.canExecuteFn();
  }

  protected override async executeFolder(_folder: TFolderOriginal): Promise<void> {
    await this.executeFn();
  }

  protected override shouldAddToFolderMenu(_folder: TFolderOriginal, _source: string, _leaf?: WorkspaceLeafOriginal): boolean {
    return true;
  }
}

function createMockTFolder(path: string): TFolderOriginal {
  return TFolder.create__(castTo(app.vault), path).asOriginalType2__();
}

function createParams(overrides?: Partial<AbstractFileCommandHandlerParams>): AbstractFileCommandHandlerParams {
  return {
    icon: 'folder-icon',
    id: 'test-folder-cmd',
    name: 'Test Folder Command',
    pluginName: 'Test Plugin',
    ...overrides
  };
}

function setupApp(): void {
  app = App.createConfigured__().asOriginalType__();
}

describe('FolderCommandHandler', () => {
  setupApp();

  describe('type filtering', () => {
    it('should reject non-TFolder instances', async () => {
      const handler = new TestFolderHandler(createParams());
      const activeFileProvider: ActiveFileProvider = { getActiveFile: () => null };

      await handler.onRegistered({
        activeFileProvider,
        menuEventRegistrar: {
          registerEditorMenuEventHandler: vi.fn(),
          registerFileMenuEventHandler: vi.fn(),
          registerFilesMenuEventHandler: vi.fn()
        }
      });

      // Active file is not a folder, so command palette should not work
      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });

  describe('multi-folder', () => {
    it('should execute folders sequentially', async () => {
      const executionOrder: string[] = [];

      class SequentialFolderHandler extends FolderCommandHandler {
        public async publicExecuteFolders(folders: TFolderOriginal[]): Promise<void> {
          await this.executeFolders(folders);
        }

        protected override canExecuteFolder(): boolean {
          return true;
        }

        protected override async executeFolder(folder: TFolderOriginal): Promise<void> {
          await Promise.resolve();
          executionOrder.push(folder.path);
        }
      }

      const handler = new SequentialFolderHandler(createParams());

      const folder1 = createMockTFolder('dir-a');
      const folder2 = createMockTFolder('dir-b');

      await handler.publicExecuteFolders([folder1, folder2]);
      expect(executionOrder).toEqual(['dir-a', 'dir-b']);
    });

    it('should return false for canExecuteFolders when any folder fails check', () => {
      class SelectiveFolderHandler extends FolderCommandHandler {
        public publicCanExecuteFolders(folders: TFolderOriginal[]): boolean {
          return this.canExecuteFolders(folders);
        }

        protected override canExecuteFolder(folder: TFolderOriginal): boolean {
          return folder.path !== 'blocked';
        }

        protected override async executeFolder(): Promise<void> {
          await Promise.resolve();
        }
      }

      const handler = new SelectiveFolderHandler(createParams());

      const folder1 = createMockTFolder('ok');
      const folder2 = createMockTFolder('blocked');

      expect(handler.publicCanExecuteFolders([folder1, folder2])).toBe(false);
    });
  });
});
