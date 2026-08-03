/**
 * @file
 *
 * Tests for {@link EditorCommandHandler}.
 */

import type {
  Editor as EditorOriginal,
  MarkdownFileInfo as MarkdownFileInfoOriginal,
  Menu as MenuOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DisposableEx } from '../../disposable.ts';
import type { EditorMenuEventHandler } from '../menu-event-registrar.ts';
import type { CommandHandlerRegistrationContext } from './command-handler.ts';
import type { EditorCommandHandlerConstructorParams } from './editor-command-handler.ts';

import { noopAsync } from '../../function.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { EditorCommandHandler } from './editor-command-handler.ts';

interface MockContext {
  context: CommandHandlerRegistrationContext;
  editorMenuHandlers: EditorMenuEventHandler[];
}

class TestEditorHandler extends EditorCommandHandler {
  public canExecuteFunction = vi.fn(() => true);
  public executeFunction = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  public shouldAddToCommandPaletteFunction = vi.fn(() => true);
  public shouldAddToEditorMenuFunction = vi.fn(() => false);

  protected override canExecuteEditor(editor: EditorOriginal, context: MarkdownFileInfoOriginal): boolean {
    super.canExecuteEditor(editor, context);
    return this.canExecuteFunction();
  }

  protected override async executeEditor(_editor: EditorOriginal, _context: MarkdownFileInfoOriginal): Promise<void> {
    await this.executeFunction();
  }

  protected override shouldAddToCommandPalette(): boolean {
    super.shouldAddToCommandPalette();
    return this.shouldAddToCommandPaletteFunction();
  }

  protected override shouldAddToEditorMenu(editor: EditorOriginal, context: MarkdownFileInfoOriginal): boolean {
    super.shouldAddToEditorMenu(editor, context);
    return this.shouldAddToEditorMenuFunction();
  }
}

function createMockContext(): MockContext {
  const editorMenuHandlers: EditorMenuEventHandler[] = [];
  return {
    context: {
      activeFileProvider: { getActiveFile: () => null },
      menuEventRegistrar: {
        registerEditorMenuEventHandler: (handler: EditorMenuEventHandler): DisposableEx => {
          editorMenuHandlers.push(handler);
          return strictProxy<DisposableEx>({});
        },
        registerFileMenuEventHandler: vi.fn(),
        registerFilesMenuEventHandler: vi.fn()
      },
      pluginName: 'Test Plugin'
    },
    editorMenuHandlers
  };
}

function createMockEditor(): EditorOriginal {
  return strictProxy<EditorOriginal>({});
}

function createMockMarkdownFileInfo(): MarkdownFileInfoOriginal {
  return strictProxy<MarkdownFileInfoOriginal>({});
}

function createParams(overrides?: Partial<EditorCommandHandlerConstructorParams>): EditorCommandHandlerConstructorParams {
  return {
    icon: 'test-icon',
    id: 'test-editor-cmd',
    name: 'Test Editor Command',
    ...overrides
  };
}

describe('EditorCommandHandler', () => {
  it('should build a command with editorCheckCallback', () => {
    const handler = new TestEditorHandler(createParams());
    const command = handler.buildCommand();

    expect(command.id).toBe('test-editor-cmd');
    expect(command.editorCheckCallback).toBeDefined();
  });

  it('should return true from editorCheckCallback when canExecuteEditor returns true (checking=true)', () => {
    const handler = new TestEditorHandler(createParams());
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockMarkdownFileInfo());
    expect(result).toBe(true);
    expect(handler.executeFunction).not.toHaveBeenCalled();
  });

  it('should return false when shouldAddToCommandPalette returns false', () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToCommandPaletteFunction.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockMarkdownFileInfo());
    expect(result).toBe(false);
  });

  it('should return false when canExecuteEditor returns false', () => {
    const handler = new TestEditorHandler(createParams());
    handler.canExecuteFunction.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(false, createMockEditor(), createMockMarkdownFileInfo());
    expect(result).toBe(false);
    expect(handler.executeFunction).not.toHaveBeenCalled();
  });

  it('should call executeEditor when checking=false and canExecute returns true', () => {
    const handler = new TestEditorHandler(createParams());
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(false, createMockEditor(), createMockMarkdownFileInfo());
    expect(result).toBe(true);
    expect(handler.executeFunction).toHaveBeenCalledOnce();
  });

  it('should register editor-menu event handler on registration', async () => {
    const handler = new TestEditorHandler(createParams());
    const { context, editorMenuHandlers } = createMockContext();

    await handler.onRegistered(context);
    expect(editorMenuHandlers).toHaveLength(1);
  });

  it('should not add menu item when shouldAddToEditorMenu returns false', async () => {
    const handler = new TestEditorHandler(createParams());
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should add menu item when shouldAddToEditorMenu returns true', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(addItem).toHaveBeenCalledOnce();
  });

  it('should not add menu item when canExecuteEditor returns false', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    handler.canExecuteFunction.mockReturnValue(false);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should set section submenu when shouldAddCommandToSubmenu is true', async () => {
    const handler = new TestEditorHandler(createParams({
      editorMenuSection: 'my-section',
      editorMenuSubmenuIcon: 'folder',
      shouldAddCommandToSubmenu: true
    }));
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(setSectionSubmenu).toHaveBeenCalledWith('my-section', {
      icon: 'folder',
      title: 'my-section'
    });
  });

  it('should use pluginName as default section', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const menu = strictProxy<MenuOriginal>({ setSectionSubmenu });
    const addItem = vi.fn((callback: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn().mockReturnThis(),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      callback(item);
      expect(item.setSection).toHaveBeenCalledWith('Test Plugin');
      return menu;
    });
    Object.assign(menu, { addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());
  });

  it('should use default submenu icon as empty string when not provided', async () => {
    const handler = new TestEditorHandler(createParams({
      shouldAddCommandToSubmenu: true
    }));
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(setSectionSubmenu).toHaveBeenCalledWith('Test Plugin', {
      icon: '',
      title: 'Test Plugin'
    });
  });

  it('should execute via menu item onClick callback', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const menu = strictProxy<MenuOriginal>({});
    const addItem = vi.fn((callback: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn((clickCallback: () => void) => {
          clickCallback();
          return item;
        }),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      callback(item);
      return menu;
    });
    Object.assign(menu, { addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(handler.executeFunction).toHaveBeenCalledOnce();
  });

  it('should use default canExecuteEditor returning true', () => {
    class DefaultEditorHandler extends EditorCommandHandler {
      public executeFunction = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      protected override async executeEditor(_editor: EditorOriginal, _context: MarkdownFileInfoOriginal): Promise<void> {
        await this.executeFunction();
      }
    }

    const handler = new DefaultEditorHandler(createParams());
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockMarkdownFileInfo());
    expect(result).toBe(true);
  });

  it('should use default shouldAddToEditorMenu returning false', async () => {
    class DefaultMenuHandler extends EditorCommandHandler {
      protected override async executeEditor(): Promise<void> {
        await noopAsync();
      }
    }

    const handler = new DefaultMenuHandler(createParams());
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should use default shouldAddToCommandPalette returning true', () => {
    class DefaultPaletteHandler extends EditorCommandHandler {
      protected override async executeEditor(): Promise<void> {
        await noopAsync();
      }
    }

    const handler = new DefaultPaletteHandler(createParams());
    const command = handler.buildCommand();

    expect(command.editorCheckCallback?.(true, createMockEditor(), createMockMarkdownFileInfo())).toBe(true);
  });

  it('should use editorMenuItemName when provided', async () => {
    const handler = new TestEditorHandler(createParams({
      editorMenuItemName: 'Custom Item'
    }));
    handler.shouldAddToEditorMenuFunction.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const menu = strictProxy<MenuOriginal>({});
    const addItem = vi.fn((callback: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn().mockReturnThis(),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      callback(item);
      expect(item.setTitle).toHaveBeenCalledWith('Custom Item');
      return menu;
    });
    Object.assign(menu, { addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockMarkdownFileInfo());
  });
});
