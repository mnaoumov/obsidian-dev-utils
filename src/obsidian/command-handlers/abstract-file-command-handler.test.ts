/**
 * @file
 *
 * Tests for {@link AbstractFileCommandHandler}.
 */

import type {
  Menu as MenuOriginal,
  TAbstractFile as TAbstractFileOriginal,
  TFile as TFileOriginal,
  WorkspaceLeaf as WorkspaceLeafOriginal
} from 'obsidian';

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

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { AbstractFileCommandHandler } from './abstract-file-command-handler.ts';

interface MockContext {
  context: CommandHandlerRegistrationContext;
  fileMenuHandlers: FileMenuEventHandler[];
  filesMenuHandlers: FilesMenuEventHandler[];
}

class TestAbstractFileHandler extends AbstractFileCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  public shouldAddToMenuFn = vi.fn(() => false);

  protected override canExecuteAbstractFile(_abstractFile: TAbstractFileOriginal): boolean {
    return this.canExecuteFn();
  }

  protected override async executeAbstractFile(_abstractFile: TAbstractFileOriginal): Promise<void> {
    await this.executeFn();
  }

  protected override shouldAddToAbstractFileMenu(_abstractFile: TAbstractFileOriginal, _source: string, _leaf?: WorkspaceLeafOriginal): boolean {
    return this.shouldAddToMenuFn();
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

function createMockFile(): TFileOriginal {
  return strictProxy<TFileOriginal>({ path: 'test.md' });
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

describe('AbstractFileCommandHandler', () => {
  describe('checkCallback (command palette)', () => {
    it('should return true when active file exists and canExecuteAbstractFile returns true', async () => {
      const file = createMockFile();
      const handler = new TestAbstractFileHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });

    it('should return false when no active file', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      const { context } = createMockContext();
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });

    it('should return false when canExecuteAbstractFile returns false', async () => {
      const file = createMockFile();
      const handler = new TestAbstractFileHandler(createParams());
      handler.canExecuteFn.mockReturnValue(false);
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });

    it('should call executeAbstractFile when checking=false', async () => {
      const file = createMockFile();
      const handler = new TestAbstractFileHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      command.checkCallback?.(false);
      expect(handler.executeFn).toHaveBeenCalledOnce();
    });
  });

  describe('file menu', () => {
    it('should register file-menu and files-menu handlers', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      const { context, fileMenuHandlers, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      expect(fileMenuHandlers).toHaveLength(1);
      expect(filesMenuHandlers).toHaveLength(1);
    });

    it('should not add menu item when shouldAddToAbstractFileMenu returns false', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should add menu item when shouldAddToAbstractFileMenu and canExecuteAbstractFile return true', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      handler.shouldAddToMenuFn.mockReturnValue(true);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(addItem).toHaveBeenCalledOnce();
    });

    it('should not add menu item when canExecuteAbstractFile returns false', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      handler.shouldAddToMenuFn.mockReturnValue(true);
      handler.canExecuteFn.mockReturnValue(false);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });
  });

  describe('multi-file', () => {
    it('should execute files sequentially by default', async () => {
      const executionOrder: string[] = [];
      class SequentialHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(abstractFile: TAbstractFileOriginal): Promise<void> {
          await Promise.resolve();
          executionOrder.push(abstractFile.path);
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new SequentialHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const file1 = strictProxy<TAbstractFileOriginal>({ path: 'a.md' });
      const file2 = strictProxy<TAbstractFileOriginal>({ path: 'b.md' });

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

      // Wait for async execution
      await vi.waitFor(() => {
        expect(executionOrder).toEqual(['a.md', 'b.md']);
      });
    });

    it('should return false for canExecuteAbstractFiles when array is empty', async () => {
      class EmptyCheckHandler extends AbstractFileCommandHandler {
        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new EmptyCheckHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });
  });

  describe('submenu', () => {
    it('should set section submenu when shouldAddCommandToSubmenu is true', async () => {
      const handler = new TestAbstractFileHandler(createParams({
        fileMenuSection: 'my-section',
        fileMenuSubmenuIcon: 'folder',
        shouldAddCommandToSubmenu: true
      }));
      handler.shouldAddToMenuFn.mockReturnValue(true);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const setSectionSubmenu = vi.fn();
      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(setSectionSubmenu).toHaveBeenCalledWith('my-section', {
        icon: 'folder',
        title: 'my-section'
      });
    });
  });
});
