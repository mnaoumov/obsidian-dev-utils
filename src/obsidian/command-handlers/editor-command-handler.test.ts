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

import type { EditorMenuEventHandler } from '../menu-event-registrar.ts';
import type { CommandHandlerRegistrationContext } from './command-handler.ts';
import type { EditorCommandHandlerParams } from './editor-command-handler.ts';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { EditorCommandHandler } from './editor-command-handler.ts';

interface MockContext {
  context: CommandHandlerRegistrationContext;
  editorMenuHandlers: EditorMenuEventHandler[];
}

class TestEditorHandler extends EditorCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  public shouldAddToCommandPaletteFn = vi.fn(() => true);
  public shouldAddToEditorMenuFn = vi.fn(() => false);

  protected override canExecuteEditor(_editor: EditorOriginal, _ctx: MarkdownFileInfoOriginal): boolean {
    return this.canExecuteFn();
  }

  protected override async executeEditor(_editor: EditorOriginal, _ctx: MarkdownFileInfoOriginal): Promise<void> {
    await this.executeFn();
  }

  protected override shouldAddToCommandPalette(): boolean {
    return this.shouldAddToCommandPaletteFn();
  }

  protected override shouldAddToEditorMenu(_editor: EditorOriginal, _ctx: MarkdownFileInfoOriginal): boolean {
    return this.shouldAddToEditorMenuFn();
  }
}

function createMockContext(): MockContext {
  const editorMenuHandlers: EditorMenuEventHandler[] = [];
  return {
    context: {
      activeFileProvider: { getActiveFile: () => null },
      menuEventRegistrar: {
        registerEditorMenuEventHandler: (handler: EditorMenuEventHandler): void => {
          editorMenuHandlers.push(handler);
        },
        registerFileMenuEventHandler: vi.fn(),
        registerFilesMenuEventHandler: vi.fn()
      }
    },
    editorMenuHandlers
  };
}

function createMockCtx(): MarkdownFileInfoOriginal {
  return strictProxy<MarkdownFileInfoOriginal>({});
}

function createMockEditor(): EditorOriginal {
  return strictProxy<EditorOriginal>({});
}

function createParams(overrides?: Partial<EditorCommandHandlerParams>): EditorCommandHandlerParams {
  return {
    icon: 'test-icon',
    id: 'test-editor-cmd',
    name: 'Test Editor Command',
    pluginName: 'Test Plugin',
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

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockCtx());
    expect(result).toBe(true);
    expect(handler.executeFn).not.toHaveBeenCalled();
  });

  it('should return false when shouldAddToCommandPalette returns false', () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToCommandPaletteFn.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockCtx());
    expect(result).toBe(false);
  });

  it('should return false when canExecuteEditor returns false', () => {
    const handler = new TestEditorHandler(createParams());
    handler.canExecuteFn.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(false, createMockEditor(), createMockCtx());
    expect(result).toBe(false);
    expect(handler.executeFn).not.toHaveBeenCalled();
  });

  it('should call executeEditor when checking=false and canExecute returns true', () => {
    const handler = new TestEditorHandler(createParams());
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(false, createMockEditor(), createMockCtx());
    expect(result).toBe(true);
    expect(handler.executeFn).toHaveBeenCalledOnce();
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
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should add menu item when shouldAddToEditorMenu returns true', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(addItem).toHaveBeenCalledOnce();
  });

  it('should not add menu item when canExecuteEditor returns false', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    handler.canExecuteFn.mockReturnValue(false);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should set section submenu when shouldAddCommandToSubmenu is true', async () => {
    const handler = new TestEditorHandler(createParams({
      editorMenuSection: 'my-section',
      editorMenuSubmenuIcon: 'folder',
      shouldAddCommandToSubmenu: true
    }));
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(setSectionSubmenu).toHaveBeenCalledWith('my-section', {
      icon: 'folder',
      title: 'my-section'
    });
  });

  it('should use pluginName as default section', async () => {
    const handler = new TestEditorHandler(createParams({ pluginName: 'My Plugin' }));
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const menu = strictProxy<MenuOriginal>({ setSectionSubmenu });
    const addItem = vi.fn((cb: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn().mockReturnThis(),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      cb(item);
      expect(item.setSection).toHaveBeenCalledWith('My Plugin');
      return menu;
    });
    Object.assign(menu, { addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());
  });

  it('should use default submenu icon as empty string when not provided', async () => {
    const handler = new TestEditorHandler(createParams({
      shouldAddCommandToSubmenu: true
    }));
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const setSectionSubmenu = vi.fn();
    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem, setSectionSubmenu });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(setSectionSubmenu).toHaveBeenCalledWith('Test Plugin', {
      icon: '',
      title: 'Test Plugin'
    });
  });

  it('should execute via menu item onClick callback', async () => {
    const handler = new TestEditorHandler(createParams());
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

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
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(handler.executeFn).toHaveBeenCalledOnce();
  });

  it('should use default canExecuteEditor returning true', () => {
    class DefaultEditorHandler extends EditorCommandHandler {
      public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      protected override async executeEditor(_editor: EditorOriginal, _ctx: MarkdownFileInfoOriginal): Promise<void> {
        await this.executeFn();
      }
    }

    const handler = new DefaultEditorHandler(createParams());
    const command = handler.buildCommand();

    const result = command.editorCheckCallback?.(true, createMockEditor(), createMockCtx());
    expect(result).toBe(true);
  });

  it('should use default shouldAddToEditorMenu returning false', async () => {
    class DefaultMenuHandler extends EditorCommandHandler {
      protected override async executeEditor(): Promise<void> {
        await Promise.resolve();
      }
    }

    const handler = new DefaultMenuHandler(createParams());
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const addItem = vi.fn();
    const menu = strictProxy<MenuOriginal>({ addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());

    expect(addItem).not.toHaveBeenCalled();
  });

  it('should use default shouldAddToCommandPalette returning true', () => {
    class DefaultPaletteHandler extends EditorCommandHandler {
      protected override async executeEditor(): Promise<void> {
        await Promise.resolve();
      }
    }

    const handler = new DefaultPaletteHandler(createParams());
    const command = handler.buildCommand();

    expect(command.editorCheckCallback?.(true, createMockEditor(), createMockCtx())).toBe(true);
  });

  it('should use editorMenuItemName when provided', async () => {
    const handler = new TestEditorHandler(createParams({
      editorMenuItemName: 'Custom Item'
    }));
    handler.shouldAddToEditorMenuFn.mockReturnValue(true);
    const { context, editorMenuHandlers } = createMockContext();
    await handler.onRegistered(context);

    const menu = strictProxy<MenuOriginal>({});
    const addItem = vi.fn((cb: (item: unknown) => void) => {
      const item = {
        onClick: vi.fn().mockReturnThis(),
        setIcon: vi.fn().mockReturnThis(),
        setSection: vi.fn().mockReturnThis(),
        setTitle: vi.fn().mockReturnThis()
      };
      cb(item);
      expect(item.setTitle).toHaveBeenCalledWith('Custom Item');
      return menu;
    });
    Object.assign(menu, { addItem });
    editorMenuHandlers[0]?.(menu, createMockEditor(), createMockCtx());
  });
});
