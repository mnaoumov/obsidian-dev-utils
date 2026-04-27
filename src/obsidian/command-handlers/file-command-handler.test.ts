/**
 * @file
 *
 * Tests for {@link FileCommandHandler}.
 */

import type {
  App as AppOriginal,
  Menu as MenuOriginal,
  TFile as TFileOriginal,
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
import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';
import type { CommandHandlerRegistrationContext } from './command-handler.ts';

import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { FileCommandHandler } from './file-command-handler.ts';

let app: AppOriginal;

interface MockContext {
  context: CommandHandlerRegistrationContext;
  fileMenuHandlers: FileMenuEventHandler[];
  filesMenuHandlers: FilesMenuEventHandler[];
}

class TestFileHandler extends FileCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  protected override canExecuteFile(_file: TFileOriginal): boolean {
    return this.canExecuteFn();
  }

  protected override async executeFile(_file: TFileOriginal): Promise<void> {
    await this.executeFn();
  }

  protected override shouldAddToFileMenu(_file: TFileOriginal, _source: string, _leaf?: WorkspaceLeafOriginal): boolean {
    return true;
  }
}

function createMockContext(activeFile?: TFileOriginal): MockContext {
  const fileMenuHandlers: FileMenuEventHandler[] = [];
  const filesMenuHandlers: FilesMenuEventHandler[] = [];
  const activeFileProvider: ActiveFileProvider = {
    getActiveFile: () => activeFile ?? null
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

function createMockTFile(path = 'test.md'): TFileOriginal {
  return TFile.create__(castTo(app.vault), path).asOriginalType2__();
}

function createParams(overrides?: Partial<AbstractFileCommandHandlerParams>): AbstractFileCommandHandlerParams {
  return {
    icon: 'file-icon',
    id: 'test-file-cmd',
    name: 'Test File Command',
    pluginName: 'Test Plugin',
    ...overrides
  };
}

function setupApp(): void {
  app = App.createConfigured__().asOriginalType__();
}

describe('FileCommandHandler', () => {
  setupApp();

  describe('type filtering', () => {
    it('should accept TFile instances via canExecuteAbstractFile', async () => {
      const file = createMockTFile();
      const handler = new TestFileHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should reject non-TFile instances', async () => {
      const folder = TFolder.create__(castTo(app.vault), 'some-folder').asOriginalType2__();
      const handler = new TestFileHandler(createParams());
      const activeFileProvider: ActiveFileProvider = { getActiveFile: () => castTo(folder) };

      await handler.onRegistered({
        activeFileProvider,
        menuEventRegistrar: {
          registerEditorMenuEventHandler: vi.fn(),
          registerFileMenuEventHandler: vi.fn(),
          registerFilesMenuEventHandler: vi.fn()
        }
      });

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });

  describe('default methods', () => {
    it('should use default canExecuteFile returning true', async () => {
      class DefaultFileHandler extends FileCommandHandler {
        public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

        protected override async executeFile(_file: TFileOriginal): Promise<void> {
          await this.executeFn();
        }
      }

      const file = createMockTFile();
      const handler = new DefaultFileHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should use default shouldAddToFileMenu returning false', async () => {
      class DefaultMenuFileHandler extends FileCommandHandler {
        protected override async executeFile(): Promise<void> {
          await Promise.resolve();
        }
      }

      const handler = new DefaultMenuFileHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockTFile(), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should use default shouldAddToFilesMenu returning false', async () => {
      class DefaultFilesMenuHandler extends FileCommandHandler {
        protected override async executeFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToFileMenu(): boolean {
          return true;
        }
      }

      const handler = new DefaultFilesMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockTFile()], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should use default canExecuteFiles checking each file individually', () => {
      class SelectiveFileHandler extends FileCommandHandler {
        public publicCanExecuteFiles(files: TFileOriginal[]): boolean {
          return this.canExecuteFiles(files);
        }

        protected override canExecuteFile(file: TFileOriginal): boolean {
          return file.path !== 'blocked.md';
        }

        protected override async executeFile(): Promise<void> {
          await Promise.resolve();
        }
      }

      const handler = new SelectiveFileHandler(createParams());
      const file1 = createMockTFile('ok.md');
      const file2 = createMockTFile('blocked.md');

      expect(handler.publicCanExecuteFiles([file1])).toBe(true);
      expect(handler.publicCanExecuteFiles([file1, file2])).toBe(false);
      expect(handler.publicCanExecuteFiles([])).toBe(false);
    });
  });

  describe('multi-file type filtering', () => {
    it('should reject multi-file when any item is not a TFile', async () => {
      const handler = new TestFileHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const folder = TFolder.create__(castTo(app.vault), 'some-folder').asOriginalType2__();
      const file = createMockTFile();

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [file, castTo(folder)], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should accept multi-file when all items are TFile', async () => {
      class FilesMenuHandler extends FileCommandHandler {
        protected override async executeFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToFileMenu(): boolean {
          return true;
        }

        protected override shouldAddToFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockTFile('a.md'), createMockTFile('b.md')], 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });

    it('should reject file menu for non-TFile instances', async () => {
      const handler = new TestFileHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const folder = TFolder.create__(castTo(app.vault), 'some-folder').asOriginalType2__();

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, castTo(folder), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });
  });

  describe('execution delegation', () => {
    it('should delegate executeAbstractFile to executeFile', async () => {
      const executedFiles: string[] = [];

      class TrackingFileHandler extends FileCommandHandler {
        protected override async executeFile(file: TFileOriginal): Promise<void> {
          await Promise.resolve();
          executedFiles.push(file.path);
        }

        protected override shouldAddToFileMenu(): boolean {
          return true;
        }
      }

      const handler = new TrackingFileHandler(createParams());
      const file = createMockTFile('target.md');
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      // Trigger via command palette (checking=false calls execute -> executeAbstractFile -> executeFile)
      const command = handler.buildCommand();
      command.checkCallback?.(false);

      await vi.waitFor(() => {
        expect(executedFiles).toEqual(['target.md']);
      });
    });

    it('should delegate executeAbstractFiles to executeFiles', async () => {
      const executedFiles: string[] = [];

      class TrackingFilesHandler extends FileCommandHandler {
        protected override async executeFile(file: TFileOriginal): Promise<void> {
          await Promise.resolve();
          executedFiles.push(file.path);
        }

        protected override shouldAddToFileMenu(): boolean {
          return true;
        }

        protected override shouldAddToFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new TrackingFilesHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const file1 = createMockTFile('a.md');
      const file2 = createMockTFile('b.md');

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
      filesMenuHandlers[0]?.(menu, [file1, file2], 'file-explorer-context-menu');

      await vi.waitFor(() => {
        expect(executedFiles).toEqual(['a.md', 'b.md']);
      });
    });
  });

  describe('multi-file', () => {
    it('should execute files sequentially', async () => {
      const executionOrder: string[] = [];

      class SequentialFileHandler extends FileCommandHandler {
        public async publicExecuteFiles(files: TFileOriginal[]): Promise<void> {
          await this.executeFiles(files);
        }

        protected override canExecuteFile(): boolean {
          return true;
        }

        protected override async executeFile(file: TFileOriginal): Promise<void> {
          await Promise.resolve();
          executionOrder.push(file.path);
        }
      }

      const handler = new SequentialFileHandler(createParams());

      const file1 = createMockTFile('a.md');
      const file2 = createMockTFile('b.md');

      await handler.publicExecuteFiles([file1, file2]);
      expect(executionOrder).toEqual(['a.md', 'b.md']);
    });
  });
});
