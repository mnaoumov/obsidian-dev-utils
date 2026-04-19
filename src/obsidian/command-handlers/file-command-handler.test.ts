/**
 * @file
 *
 * Tests for {@link FileCommandHandler}.
 */

import type {
  App as AppOriginal,
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

import type { AbstractFileCommandHandlerParams } from './abstract-file-command-handler.ts';
import type { ActiveFileProvider } from './command-handler.ts';

import { castTo } from '../../object-utils.ts';
import { FileCommandHandler } from './file-command-handler.ts';

let app: AppOriginal;

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
      const activeFileProvider: ActiveFileProvider = { getActiveFile: () => file };

      await handler.onRegistered({
        activeFileProvider,
        menuEventRegistrar: {
          registerEditorMenuEventHandler: vi.fn(),
          registerFileMenuEventHandler: vi.fn(),
          registerFilesMenuEventHandler: vi.fn()
        }
      });

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
