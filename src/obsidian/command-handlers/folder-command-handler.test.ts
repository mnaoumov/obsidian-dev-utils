/**
 * @file
 *
 * Tests for {@link FolderCommandHandler}.
 */

import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TFolder as TFolderOriginal,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

import {
  App,
  TFile,
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';
import type {
  ActiveFileProvider,
  CommandHandlerRegistrationContext,
  FileMenuEventHandler,
  FilesMenuEventHandler
} from './command-handler.ts';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { FolderCommandHandler } from './folder-command-handler.ts';

let app: AppOriginal;

interface MockContext {
  context: CommandHandlerRegistrationContext;
  fileMenuHandlers: FileMenuEventHandler[];
  filesMenuHandlers: FilesMenuEventHandler[];
}

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

function createMockContext(activeFile?: TFolderOriginal): MockContext {
  const fileMenuHandlers: FileMenuEventHandler[] = [];
  const filesMenuHandlers: FilesMenuEventHandler[] = [];
  const activeFileProvider: ActiveFileProvider = {
    getActiveFile: () => castTo(activeFile ?? null)
  };

  return {
    context: {
      activeFileProvider,
      menuEventRegistrar: {
        registerEditorMenuEventHandler: vi.fn(),
        registerFileMenuEventHandler: (handler: FileMenuEventHandler): void => {
          fileMenuHandlers.push(handler);
        },
        registerFilesMenuEventHandler: (handler: FilesMenuEventHandler): void => {
          filesMenuHandlers.push(handler);
        }
      }
    },
    fileMenuHandlers,
    filesMenuHandlers
  };
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
    it('should accept TFolder instances via canExecuteAbstractFile', async () => {
      const folder = createMockTFolder('my-folder');
      const handler = new TestFolderHandler(createParams());
      const { context } = createMockContext(folder);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

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

    it('should reject TFile instances in canExecuteAbstractFile', async () => {
      const file = TFile.create__(castTo(app.vault), 'test.md').asOriginalType2__();
      const handler = new TestFolderHandler(createParams());
      const { context } = createMockContext(castTo(file));
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });

  describe('default methods', () => {
    it('should use default canExecuteFolder returning true', async () => {
      class DefaultFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await Promise.resolve();
        }
      }

      const folder = createMockTFolder('my-folder');
      const handler = new DefaultFolderHandler(createParams());
      const { context } = createMockContext(folder);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should use default shouldAddToFolderMenu returning false', async () => {
      class DefaultMenuFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await Promise.resolve();
        }
      }

      const handler = new DefaultMenuFolderHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockTFolder('some-folder'), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should use default shouldAddToFoldersMenu returning false', async () => {
      class DefaultFoldersMenuHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToFolderMenu(): boolean {
          return true;
        }
      }

      const handler = new DefaultFoldersMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockTFolder('a'), createMockTFolder('b')], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should use default canExecuteFolders checking each folder individually', () => {
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

      expect(handler.publicCanExecuteFolders([folder1])).toBe(true);
      expect(handler.publicCanExecuteFolders([folder1, folder2])).toBe(false);
      expect(handler.publicCanExecuteFolders([])).toBe(false);
    });
  });

  describe('multi-folder type filtering', () => {
    it('should reject multi-folder when any item is not a TFolder', async () => {
      const handler = new TestFolderHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const file = TFile.create__(castTo(app.vault), 'test.md').asOriginalType2__();
      const folder = createMockTFolder('some-folder');

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [folder, castTo(file)], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should accept multi-folder when all items are TFolder', async () => {
      class FoldersMenuHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToFolderMenu(): boolean {
          return true;
        }

        protected override shouldAddToFoldersMenu(): boolean {
          return true;
        }
      }

      const handler = new FoldersMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockTFolder('a'), createMockTFolder('b')], 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });

    it('should reject file menu for non-TFolder instances', async () => {
      const handler = new TestFolderHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const file = TFile.create__(castTo(app.vault), 'test.md').asOriginalType2__();

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, castTo(file), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });
  });

  describe('execution delegation', () => {
    it('should delegate executeAbstractFile to executeFolder', async () => {
      const executedFolders: string[] = [];

      class TrackingFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(folder: TFolderOriginal): Promise<void> {
          await Promise.resolve();
          executedFolders.push(folder.path);
        }

        protected override shouldAddToFolderMenu(): boolean {
          return true;
        }
      }

      const folder = createMockTFolder('target');
      const handler = new TrackingFolderHandler(createParams());
      const { context } = createMockContext(folder);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      command.checkCallback?.(false);

      await vi.waitFor(() => {
        expect(executedFolders).toEqual(['target']);
      });
    });

    it('should delegate executeAbstractFiles to executeFolders', async () => {
      const executedFolders: string[] = [];

      class TrackingFoldersHandler extends FolderCommandHandler {
        protected override async executeFolder(folder: TFolderOriginal): Promise<void> {
          await Promise.resolve();
          executedFolders.push(folder.path);
        }

        protected override shouldAddToFolderMenu(): boolean {
          return true;
        }

        protected override shouldAddToFoldersMenu(): boolean {
          return true;
        }
      }

      const handler = new TrackingFoldersHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const folder1 = createMockTFolder('a');
      const folder2 = createMockTFolder('b');

      const menu = strictProxy<MenuOriginal>({});
      const addItem = vi.fn((cb: (item: unknown) => void) => {
        const item = {
          onClick: vi.fn((clickCb: () => void) => {
            clickCb();
            return item;
          }),
          setIcon: vi.fn().mockReturnThis(),
          setSection: vi.fn().mockReturnThis(),
          setTitle: vi.fn().mockReturnThis()
        };
        cb(item);
        return menu;
      });
      Object.assign(menu, { addItem });
      filesMenuHandlers[0]?.(menu, [folder1, folder2], 'file-explorer-context-menu');

      await vi.waitFor(() => {
        expect(executedFolders).toEqual(['a', 'b']);
      });
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
  });
});
