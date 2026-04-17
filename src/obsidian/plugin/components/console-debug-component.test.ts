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

vi.mock('../../../debug.ts', () => ({
  getDebugger: mocks.getDebugger
}));

describe('ConsoleDebugComponent', () => {
  it('should call getDebugger with plugin id and log message', () => {
    const debugFn = vi.fn();
    mocks.getDebugger.mockReturnValue(debugFn);

    const component = new ConsoleDebugComponent('my-plugin');
    component.debug('test message', 'arg1', 'arg2');

    expect(mocks.getDebugger).toHaveBeenCalledWith('my-plugin', 1);
    expect(debugFn).toHaveBeenCalledWith('test message', 'arg1', 'arg2');
  });
});
