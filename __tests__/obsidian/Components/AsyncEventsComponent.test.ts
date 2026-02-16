import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  AsyncEventsComponent,
  registerAsyncEvent
} from '../../../src/obsidian/Components/AsyncEventsComponent.ts';
import { assertNonNullable } from '../../../src/TypeGuards.ts';

describe('AsyncEventsComponent', () => {
  it('should register an async event via the class method', () => {
    const comp = new AsyncEventsComponent();
    const offref = vi.fn();
    const eventRef = {
      asyncEvents: { offref }
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Mock doesn't implement full Obsidian type
    comp.registerAsyncEvent(eventRef as any);
  });

  it('should register an async event via the standalone function', () => {
    const registerSpy = vi.fn();
    const component = { register: registerSpy };
    const offref = vi.fn();
    const eventRef = {
      asyncEvents: { offref }
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any -- Mock doesn't implement full Obsidian type
    registerAsyncEvent(component as any, eventRef as any);
    expect(registerSpy).toHaveBeenCalled();
    // Call the registered callback to cover the offref path
    const firstCall = registerSpy.mock.calls[0];
    assertNonNullable(firstCall);
    const registeredCallback = firstCall[0] as () => void;
    registeredCallback();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });
});
