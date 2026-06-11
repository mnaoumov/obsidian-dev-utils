/**
 * @file
 *
 * Tests for {@link FolderCommandHandler}.
 */

import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TAbstractFile as TAbstractFileOriginal,
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

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type {
  FileMenuEventHandler,
  FilesMenuEventHandler
} from '../menu-event-registrar.ts';
import type { AbstractFileCommandHandlerConstructorParams } from './abstract-file-command-handler.ts';
import type { CommandHandlerRegistrationContext } from './command-handler.ts';

import { noopAsync } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { FolderCommandHandler } from './folder-command-handler.ts';

let app: AppOriginal;

interface MockContext {
  context: CommandHandlerRegistrationContext;
  fileMenuHandlers: FileMenuEventHandler[];
  filesMenuHandlers: FilesMenuEventHandler[];
}

interface MutableParent {
  parent: null | TFolderOriginal;
}

class TestFolderHandler extends FolderCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  protected override canExecuteFolder(folder: TFolderOriginal): boolean {
    super.canExecuteFolder(folder);
    return this.canExecuteFn();
  }

  protected override async executeFolder(_folder: TFolderOriginal): Promise<void> {
    await this.executeFn();
  }

  protected override shouldAddToFolderMenu(folder: TFolderOriginal, source: string, leaf?: WorkspaceLeafOriginal): boolean {
    super.shouldAddToFolderMenu(folder, source, leaf);
    return true;
  }
}

function createMockActiveFile(parentFolder: TFolderOriginal): TAbstractFileOriginal {
  const file = TFile.create__(castTo(app.vault), `${parentFolder.path}/note.md`).asOriginalType2__();
  castTo<MutableParent>(file).parent = parentFolder;
  return castTo(file);
}

function createMockContext(activeFile?: TAbstractFileOriginal): MockContext {
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
      },
      pluginName: 'Test Plugin'
    },
    fileMenuHandlers,
    filesMenuHandlers
  };
}

function createMockTFolder(path: string): TFolderOriginal {
  return TFolder.create__(castTo(app.vault), path).asOriginalType2__();
}

function createParams(overrides?: Partial<AbstractFileCommandHandlerConstructorParams>): AbstractFileCommandHandlerConstructorParams {
  return {
    icon: 'folder-icon',
    id: 'test-folder-cmd',
    name: 'Test Folder Command',
    ...overrides
  };
}

function setupApp(): void {
  app = App.createConfigured__().asOriginalType__();
}

describe('FolderCommandHandler', () => {
  setupApp();

  describe('type filtering', () => {
    it('should accept TFolder instances via canExecuteAbstractFile', () => {
      const folder = createMockTFolder('my-folder');
      const handler = new TestFolderHandler(createParams());
      const { context } = createMockContext(createMockActiveFile(folder));
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should reject non-TFolder instances', () => {
      const handler = new TestFolderHandler(createParams());
      const activeFileProvider: ActiveFileProvider = { getActiveFile: () => null };

      handler.onRegistered({
        activeFileProvider,
        menuEventRegistrar: {
          registerEditorMenuEventHandler: vi.fn(),
          registerFileMenuEventHandler: vi.fn(),
          registerFilesMenuEventHandler: vi.fn()
        },
        pluginName: 'Test Plugin'
      });

      // Active file is not a folder, so command palette should not work
      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });

    it('should reject TFile instances in canExecuteAbstractFile', () => {
      const file = TFile.create__(castTo(app.vault), 'test.md').asOriginalType2__();
      const handler = new TestFolderHandler(createParams());
      const { context } = createMockContext(castTo(file));
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });

  describe('default methods', () => {
    it('should use default canExecuteFolder returning true', () => {
      class DefaultFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await noopAsync();
        }
      }

      const folder = createMockTFolder('my-folder');
      const handler = new DefaultFolderHandler(createParams());
      const { context } = createMockContext(createMockActiveFile(folder));
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should use default shouldAddToFolderMenu returning false', () => {
      class DefaultMenuFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await noopAsync();
        }
      }

      const handler = new DefaultMenuFolderHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockTFolder('some-folder'), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should use default shouldAddToFoldersMenu returning false', () => {
      class DefaultFoldersMenuHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await noopAsync();
        }

        protected override shouldAddToFolderMenu(folder: TFolderOriginal, source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFolderMenu(folder, source, leaf);
          return true;
        }
      }

      const handler = new DefaultFoldersMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      handler.onRegistered(context);

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
          super.canExecuteFolder(folder);
          return folder.path !== 'blocked';
        }

        protected override async executeFolder(): Promise<void> {
          await noopAsync();
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
    it('should reject multi-folder when any item is not a TFolder', () => {
      const handler = new TestFolderHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      handler.onRegistered(context);

      const file = TFile.create__(castTo(app.vault), 'test.md').asOriginalType2__();
      const folder = createMockTFolder('some-folder');

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [folder, castTo(file)], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should accept multi-folder when all items are TFolder', () => {
      class FoldersMenuHandler extends FolderCommandHandler {
        protected override async executeFolder(): Promise<void> {
          await noopAsync();
        }

        protected override shouldAddToFolderMenu(folder: TFolderOriginal, source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFolderMenu(folder, source, leaf);
          return true;
        }

        protected override shouldAddToFoldersMenu(folders: TFolderOriginal[], source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFoldersMenu(folders, source, leaf);
          return true;
        }
      }

      const handler = new FoldersMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockTFolder('a'), createMockTFolder('b')], 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });

    it('should reject file menu for non-TFolder instances', () => {
      const handler = new TestFolderHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      handler.onRegistered(context);

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
          await noopAsync();
          executedFolders.push(folder.path);
        }

        protected override shouldAddToFolderMenu(folder: TFolderOriginal, source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFolderMenu(folder, source, leaf);
          return true;
        }
      }

      const folder = createMockTFolder('target');
      const handler = new TrackingFolderHandler(createParams());
      const { context } = createMockContext(createMockActiveFile(folder));
      handler.onRegistered(context);

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
          await noopAsync();
          executedFolders.push(folder.path);
        }

        protected override shouldAddToFolderMenu(folder: TFolderOriginal, source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFolderMenu(folder, source, leaf);
          return true;
        }

        protected override shouldAddToFoldersMenu(folders: TFolderOriginal[], source: string, leaf?: WorkspaceLeafOriginal): boolean {
          super.shouldAddToFoldersMenu(folders, source, leaf);
          return true;
        }
      }

      const handler = new TrackingFoldersHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      handler.onRegistered(context);

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

        protected override canExecuteFolder(folder: TFolderOriginal): boolean {
          super.canExecuteFolder(folder);
          return true;
        }

        protected override async executeFolder(folder: TFolderOriginal): Promise<void> {
          await noopAsync();
          executionOrder.push(folder.path);
        }
      }

      const handler = new SequentialFolderHandler(createParams());

      const folder1 = createMockTFolder('dir-a');
      const folder2 = createMockTFolder('dir-b');

      await handler.publicExecuteFolders([folder1, folder2]);
      expect(executionOrder).toEqual(['dir-a', 'dir-b']);
    });

    it('should return undefined when called with empty array', async () => {
      class EmptyFoldersHandler extends FolderCommandHandler {
        public async publicExecuteFolders(folders: TFolderOriginal[]): Promise<void> {
          await this.executeFolders(folders);
        }

        protected override async executeFolder(): Promise<void> {
          await noopAsync();
        }
      }

      const handler = new EmptyFoldersHandler(createParams());
      await expect(handler.publicExecuteFolders([])).resolves.toBeUndefined();
    });
  });

  describe('command palette target resolution', () => {
    it('should resolve the command palette target to the parent folder of the active file', async () => {
      const executedFolders: string[] = [];

      class TrackingFolderHandler extends FolderCommandHandler {
        protected override async executeFolder(folder: TFolderOriginal): Promise<void> {
          await noopAsync();
          executedFolders.push(folder.path);
        }
      }

      const parentFolder = createMockTFolder('parent-folder');
      const handler = new TrackingFolderHandler(createParams());
      const { context } = createMockContext(createMockActiveFile(parentFolder));
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);

      command.checkCallback?.(false);
      await vi.waitFor(() => {
        expect(executedFolders).toEqual(['parent-folder']);
      });
    });

    it('should reject the command palette when the active file has no parent', () => {
      const handler = new TestFolderHandler(createParams());
      const rootLevelFile = TFile.create__(castTo(app.vault), 'note.md').asOriginalType2__();
      const { context } = createMockContext(castTo(rootLevelFile));
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });

    it('should reject the command palette when there is no active file', () => {
      const handler = new TestFolderHandler(createParams());
      const { context } = createMockContext();
      handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });
});
