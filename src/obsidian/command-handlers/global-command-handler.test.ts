/**
 * @file
 *
 * Tests for {@link GlobalCommandHandler}.
 */

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { CommandHandlerParams } from './command-handler.ts';

import { GlobalCommandHandler } from './global-command-handler.ts';

class TestGlobalHandler extends GlobalCommandHandler {
  public canExecuteFn = vi.fn(() => true);
  public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  protected override canExecute(): boolean {
    return this.canExecuteFn();
  }

  protected override async execute(): Promise<void> {
    await this.executeFn();
  }
}

function createParams(overrides?: Partial<CommandHandlerParams>): CommandHandlerParams {
  return {
    icon: 'test-icon',
    id: 'test-id',
    name: 'Test Command',
    ...overrides
  };
}

describe('GlobalCommandHandler', () => {
  it('should build a command with checkCallback', () => {
    const handler = new TestGlobalHandler(createParams());
    const command = handler.buildCommand();

    expect(command.id).toBe('test-id');
    expect(command.name).toBe('Test Command');
    expect(command.icon).toBe('test-icon');
    expect(command.checkCallback).toBeDefined();
  });

  it('should return true from checkCallback when canExecute returns true (checking=true)', () => {
    const handler = new TestGlobalHandler(createParams());
    const command = handler.buildCommand();

    const result = command.checkCallback?.(true);
    expect(result).toBe(true);
    expect(handler.executeFn).not.toHaveBeenCalled();
  });

  it('should return false from checkCallback when canExecute returns false', () => {
    const handler = new TestGlobalHandler(createParams());
    handler.canExecuteFn.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.checkCallback?.(false);
    expect(result).toBe(false);
    expect(handler.executeFn).not.toHaveBeenCalled();
  });

  it('should call execute when checking=false and canExecute returns true', () => {
    const handler = new TestGlobalHandler(createParams());
    const command = handler.buildCommand();

    const result = command.checkCallback?.(false);
    expect(result).toBe(true);
    expect(handler.executeFn).toHaveBeenCalledOnce();
  });

  it('should use default canExecute returning true', () => {
    class DefaultCanExecuteHandler extends GlobalCommandHandler {
      public executeFn = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      protected override async execute(): Promise<void> {
        await this.executeFn();
      }
    }

    const handler = new DefaultCanExecuteHandler(createParams());
    const command = handler.buildCommand();

    expect(command.checkCallback?.(true)).toBe(true);
  });
});
