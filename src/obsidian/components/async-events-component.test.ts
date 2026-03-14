import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { assertNonNullable } from '../../type-guards.ts';
import {
  AsyncEventsComponent,
  registerAsyncEvent
} from './async-events-component.ts';

describe('AsyncEventsComponent', () => {
  it('should register an async event via the class method', () => {
    const comp = new AsyncEventsComponent();
    const offref = vi.fn();
    const eventRef = {
      asyncEvents: { offref }
    };
    comp.registerAsyncEvent(eventRef as never);
  });

  it('should register an async event via the standalone function', () => {
    const registerSpy = vi.fn();
    const component = { register: registerSpy };
    const offref = vi.fn();
    const eventRef = {
      asyncEvents: { offref }
    };
    registerAsyncEvent(component as never, eventRef as never);
    expect(registerSpy).toHaveBeenCalled();
    // Call the registered callback to cover the offref path
    const firstCall = registerSpy.mock.calls[0];
    assertNonNullable(firstCall);
    const registeredCallback = firstCall[0] as () => void;
    registeredCallback();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });
});
