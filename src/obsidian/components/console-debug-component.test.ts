import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { ConsoleDebugComponent } from './console-debug-component.ts';

const mocks = vi.hoisted(() => ({
  getDebugger: vi.fn(() => vi.fn())
}));

vi.mock('../../debug.ts', () => ({
  getDebugger: mocks.getDebugger
}));

describe('ConsoleDebugComponent', () => {
  it('should call getDebugger with plugin id and log message', () => {
    const debugFunction = vi.fn();
    mocks.getDebugger.mockReturnValue(debugFunction);

    const component = new ConsoleDebugComponent('my-plugin');
    component.load();
    component.consoleDebug('test message', 'arg1', 'arg2');

    expect(mocks.getDebugger).toHaveBeenCalledWith('my-plugin', 1);
    expect(debugFunction).toHaveBeenCalledWith('test message', 'arg1', 'arg2');
  });

  it('should warn before the message when called while unloaded', () => {
    const debugFunction = vi.fn();
    mocks.getDebugger.mockReturnValue(debugFunction);

    const component = new ConsoleDebugComponent('my-plugin');
    component.consoleDebug('test message', 'arg1');

    expect(debugFunction).toHaveBeenNthCalledWith(1, 'Plugin is unloaded but sent the following message:');
    expect(debugFunction).toHaveBeenNthCalledWith(2, 'test message', 'arg1');
  });
});
