import type {
  App as AppOriginal,
  TFile as TFileOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { ResourceLockComponent } from '../resource-lock.ts';

import { strictProxy } from '../../strict-proxy.ts';
import { UnlockActiveNoteCommandHandler } from './unlock-active-note-command-handler.ts';

interface CreateHandlerOptions {
  readonly activeFile?: null | TFileOriginal;
  readonly isLocked?: boolean;
}

interface CreateHandlerResult {
  readonly activeFile: null | TFileOriginal;
  readonly handler: UnlockActiveNoteCommandHandler;
  readonly isLockedByAncestorForPath: ResourceLockComponent['isLockedByAncestorForPath'];
  readonly requestUnlockForPath: ResourceLockComponent['requestUnlockForPath'];
}

describe('UnlockActiveNoteCommandHandler', () => {
  function createHandler(options?: CreateHandlerOptions): CreateHandlerResult {
    const activeFile = options?.activeFile === undefined ? strictProxy<TFileOriginal>({ path: 'note.md' }) : options.activeFile;
    const getActiveFile = vi.fn(() => activeFile);
    const app = strictProxy<AppOriginal>({
      workspace: { getActiveFile }
    });
    const isLockedByAncestorForPath = vi.fn(() => options?.isLocked ?? true);
    const requestUnlockForPath = vi.fn();
    const resourceLockComponent = strictProxy<ResourceLockComponent>({
      isLockedByAncestorForPath,
      requestUnlockForPath
    });
    const handler = new UnlockActiveNoteCommandHandler({
      app,
      resourceLockComponent
    });
    return { activeFile, handler, isLockedByAncestorForPath, requestUnlockForPath };
  }

  it('should build a command with checkCallback', () => {
    const { handler } = createHandler();
    const command = handler.buildCommand();
    expect(command.id).toBe('unlock-active-note');
    expect(command.name).toBe('Unlock active note');
    expect(command.icon).toBe('unlock');
    expect(command.checkCallback).toBeTypeOf('function');
  });

  it('should request unlock of the active note when executed', () => {
    const { activeFile, handler, requestUnlockForPath } = createHandler();
    handler.execute();
    expect(requestUnlockForPath).toHaveBeenCalledWith(activeFile);
  });

  it('should not request unlock when there is no active file', () => {
    const { handler, requestUnlockForPath } = createHandler({ activeFile: null });
    handler.execute();
    expect(requestUnlockForPath).not.toHaveBeenCalled();
  });

  it('should allow execution when the active note is locked (checking=true)', () => {
    const { handler, requestUnlockForPath } = createHandler({ isLocked: true });
    const command = handler.buildCommand();
    expect(command.checkCallback?.(true)).toBe(true);
    expect(requestUnlockForPath).not.toHaveBeenCalled();
  });

  it('should not allow execution when the active note is not locked', () => {
    const { handler, requestUnlockForPath } = createHandler({ isLocked: false });
    const command = handler.buildCommand();
    expect(command.checkCallback?.(false)).toBe(false);
    expect(requestUnlockForPath).not.toHaveBeenCalled();
  });

  it('should not allow execution when there is no active file', () => {
    const { handler } = createHandler({ activeFile: null });
    const command = handler.buildCommand();
    expect(command.checkCallback?.(true)).toBe(false);
  });

  it('should request unlock via checkCallback with checking=false', () => {
    const { activeFile, handler, requestUnlockForPath } = createHandler({ isLocked: true });
    const command = handler.buildCommand();
    expect(command.checkCallback?.(false)).toBe(true);
    expect(requestUnlockForPath).toHaveBeenCalledWith(activeFile);
  });
});
