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

import type { CommandHandlerConstructorParams } from './command-handler.ts';

import { GlobalCommandHandler } from './global-command-handler.ts';

class TestGlobalHandler extends GlobalCommandHandler {
  public canExecuteFunction = vi.fn(() => true);
  public executeFunction = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  protected override canExecute(): boolean {
    super.canExecute();
    return this.canExecuteFunction();
  }

  protected override async execute(): Promise<void> {
    await this.executeFunction();
  }
}

function createParams(overrides?: Partial<CommandHandlerConstructorParams>): CommandHandlerConstructorParams {
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
    expect(handler.executeFunction).not.toHaveBeenCalled();
  });

  it('should return false from checkCallback when canExecute returns false', () => {
    const handler = new TestGlobalHandler(createParams());
    handler.canExecuteFunction.mockReturnValue(false);
    const command = handler.buildCommand();

    const result = command.checkCallback?.(false);
    expect(result).toBe(false);
    expect(handler.executeFunction).not.toHaveBeenCalled();
  });

  it('should call execute when checking=false and canExecute returns true', () => {
    const handler = new TestGlobalHandler(createParams());
    const command = handler.buildCommand();

    const result = command.checkCallback?.(false);
    expect(result).toBe(true);
    expect(handler.executeFunction).toHaveBeenCalledOnce();
  });

  it('should use default canExecute returning true', () => {
    class DefaultCanExecuteHandler extends GlobalCommandHandler {
      public executeFunction = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

      protected override async execute(): Promise<void> {
        await this.executeFunction();
      }
    }

    const handler = new DefaultCanExecuteHandler(createParams());
    const command = handler.buildCommand();

    expect(command.checkCallback?.(true)).toBe(true);
  });
});
