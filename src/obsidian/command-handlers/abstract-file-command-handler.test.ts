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

import type { ActiveFileProvider } from '../active-file-provider.ts';
import type {
  FileMenuEventHandler,
  FilesMenuEventHandler
} from '../menu-event-registrar.ts';
import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';
import type { CommandHandlerRegistrationContext } from './command-handler.ts';

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

  describe('file menu item details', () => {
    it('should set title, icon, section and onClick on menu item', async () => {
      const handler = new TestAbstractFileHandler(createParams({
        fileMenuItemName: 'Custom Name',
        fileMenuSection: 'custom-section'
      }));
      handler.shouldAddToMenuFn.mockReturnValue(true);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const menu = strictProxy<MenuOriginal>({});
      const setTitle = vi.fn().mockReturnThis();
      const setIcon = vi.fn().mockReturnThis();
      const setSection = vi.fn().mockReturnThis();
      const onClick = vi.fn((clickCb: () => void) => {
        clickCb();
      });
      const addItem = vi.fn((cb: (item: unknown) => void) => {
        cb({ onClick, setIcon, setSection, setTitle });
        return menu;
      });
      Object.assign(menu, { addItem });

      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(setTitle).toHaveBeenCalledWith('Custom Name');
      expect(setIcon).toHaveBeenCalledWith('file-icon');
      expect(setSection).toHaveBeenCalledWith('custom-section');
      expect(handler.executeFn).toHaveBeenCalledOnce();
    });

    it('should use command name when fileMenuItemName is not provided', async () => {
      const handler = new TestAbstractFileHandler(createParams());
      handler.shouldAddToMenuFn.mockReturnValue(true);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const menu = strictProxy<MenuOriginal>({});
      const setTitle = vi.fn().mockReturnThis();
      const addItem = vi.fn((cb: (item: unknown) => void) => {
        cb({
          onClick: vi.fn().mockReturnThis(),
          setIcon: vi.fn().mockReturnThis(),
          setSection: vi.fn().mockReturnThis(),
          setTitle
        });
        return menu;
      });
      Object.assign(menu, { addItem });

      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(setTitle).toHaveBeenCalledWith('Test File Command');
    });
  });

  describe('multi-file menu', () => {
    it('should not add items when shouldAddToAbstractFilesMenu returns false', async () => {
      class NoFilesMenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }
      }

      const handler = new NoFilesMenuHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should set section submenu for multi-file menu when shouldAddCommandToSubmenu is true', async () => {
      class FilesSubmenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesSubmenuHandler(createParams({
        filesMenuSection: 'multi-section',
        filesMenuSubmenuIcon: 'layers',
        shouldAddCommandToSubmenu: true
      }));
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const setSectionSubmenu = vi.fn();
      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(setSectionSubmenu).toHaveBeenCalledWith('multi-section', {
        icon: 'layers',
        title: 'multi-section'
      });
    });

    it('should fall back to file menu section and icon for multi-file submenu', async () => {
      class FilesSubmenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesSubmenuHandler(createParams({
        fileMenuSection: 'file-section',
        fileMenuSubmenuIcon: 'file-icon-sub',
        shouldAddCommandToSubmenu: true
      }));
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const setSectionSubmenu = vi.fn();
      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(setSectionSubmenu).toHaveBeenCalledWith('file-section', {
        icon: 'file-icon-sub',
        title: 'file-section'
      });
    });

    it('should use filesMenuItemName for multi-file menu item title', async () => {
      class FilesMenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesMenuHandler(createParams({
        filesMenuItemName: 'Process All'
      }));
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const menu = strictProxy<MenuOriginal>({});
      const setTitle = vi.fn().mockReturnThis();
      const addItem = vi.fn((cb: (item: unknown) => void) => {
        cb({
          onClick: vi.fn().mockReturnThis(),
          setIcon: vi.fn().mockReturnThis(),
          setSection: vi.fn().mockReturnThis(),
          setTitle
        });
        return menu;
      });
      Object.assign(menu, { addItem });

      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(setTitle).toHaveBeenCalledWith('Process All');
    });

    it('should fall back to fileMenuItemName then command name for multi-file title', async () => {
      class FilesMenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesMenuHandler(createParams({
        fileMenuItemName: 'Single Item Name'
      }));
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const menu = strictProxy<MenuOriginal>({});
      const setTitle = vi.fn().mockReturnThis();
      const addItem = vi.fn((cb: (item: unknown) => void) => {
        cb({
          onClick: vi.fn().mockReturnThis(),
          setIcon: vi.fn().mockReturnThis(),
          setSection: vi.fn().mockReturnThis(),
          setTitle
        });
        return menu;
      });
      Object.assign(menu, { addItem });

      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(setTitle).toHaveBeenCalledWith('Single Item Name');
    });

    it('should not add multi-file menu items when canExecuteAbstractFiles returns false', async () => {
      class FailCanExecuteHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return false;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FailCanExecuteHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem });
      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(addItem).not.toHaveBeenCalled();
    });

    it('should execute multi-file onClick via menu item', async () => {
      const executionOrder: string[] = [];

      class ClickableFilesHandler extends AbstractFileCommandHandler {
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

      const handler = new ClickableFilesHandler(createParams());
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const file1 = strictProxy<TAbstractFileOriginal>({ path: 'x.md' });
      const file2 = strictProxy<TAbstractFileOriginal>({ path: 'y.md' });

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
        expect(executionOrder).toEqual(['x.md', 'y.md']);
      });
    });
  });

  describe('shouldAddToCommandPalette', () => {
    it('should return false from command palette when shouldAddToCommandPalette returns false', async () => {
      class NoPaletteHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToCommandPalette(): boolean {
          return false;
        }
      }

      const file = createMockFile();
      const handler = new NoPaletteHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });

  describe('execute with no active file', () => {
    it('should not call executeAbstractFile when active file is null', async () => {
      const executeFn = vi.fn();

      class NullFileHandler extends AbstractFileCommandHandler {
        protected override canExecute(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          executeFn();
          await Promise.resolve();
        }
      }

      const handler = new NullFileHandler(createParams());
      const { context } = createMockContext();
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      command.checkCallback?.(false);

      await vi.waitFor(() => {
        expect(executeFn).not.toHaveBeenCalled();
      });
    });
  });

  describe('submenu without icons', () => {
    it('should use empty string for fileMenuSubmenuIcon when not provided', async () => {
      const handler = new TestAbstractFileHandler(createParams({
        shouldAddCommandToSubmenu: true
      }));
      handler.shouldAddToMenuFn.mockReturnValue(true);
      const { context, fileMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const setSectionSubmenu = vi.fn();
      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
      fileMenuHandlers[0]?.(menu, createMockFile(), 'file-explorer-context-menu');

      expect(setSectionSubmenu).toHaveBeenCalledWith('Test Plugin', {
        icon: '',
        title: 'Test Plugin'
      });
    });

    it('should use empty string for filesMenuSubmenuIcon when neither icon is provided', async () => {
      class FilesSubmenuHandler extends AbstractFileCommandHandler {
        protected override canExecuteAbstractFile(): boolean {
          return true;
        }

        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }

        protected override shouldAddToAbstractFilesMenu(): boolean {
          return true;
        }
      }

      const handler = new FilesSubmenuHandler(createParams({
        shouldAddCommandToSubmenu: true
      }));
      const { context, filesMenuHandlers } = createMockContext();
      await handler.onRegistered(context);

      const setSectionSubmenu = vi.fn();
      const addItem = vi.fn();
      const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
      filesMenuHandlers[0]?.(menu, [createMockFile()], 'file-explorer-context-menu');

      expect(setSectionSubmenu).toHaveBeenCalledWith('Test Plugin', {
        icon: '',
        title: 'Test Plugin'
      });
    });
  });

  describe('default canExecuteAbstractFile', () => {
    it('should return true by default', async () => {
      class DefaultCanExecuteHandler extends AbstractFileCommandHandler {
        protected override async executeAbstractFile(): Promise<void> {
          await Promise.resolve();
        }
      }

      const file = createMockFile();
      const handler = new DefaultCanExecuteHandler(createParams());
      const { context } = createMockContext(file);
      await handler.onRegistered(context);

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(true);
    });
  });

  describe('activeFileProvider before registration', () => {
    it('should return false from command palette when not yet registered', () => {
      const handler = new TestAbstractFileHandler(createParams());

      const command = handler.buildCommand();
      expect(command.checkCallback?.(true)).toBe(false);
    });
  });
});
