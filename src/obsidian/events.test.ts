/**
 * @file
 *
 * Tests for {@link subscribeEvent}, {@link subscribeDisposableEvent}, and {@link EventRefDisposable}.
 */

import type {
  EventRef as EventRefOriginal,
  Events as EventsOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../strict-proxy.ts';
import {
  EventRefDisposable,
  subscribeDisposableEvent,
  subscribeEvent
} from './events.ts';

interface Mocks {
  eventRef: EventRefOriginal;
  offref: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  source: TestEventSource;
}

// A minimal typed event source: extends the base `Events` (one `on` overload) plus one concrete overload — small
// Enough to avoid the deep-instantiation limit that the real `Workspace` (27 overloads) would hit.
interface TestEventSource extends EventsOriginal {
  on(name: 'my-event', callback: (value: number) => void): EventRefOriginal;
}

function createMocks(): Mocks {
  const offref = vi.fn();
  const events = strictProxy<EventsOriginal>({ offref });
  const eventRef = strictProxy<EventRefOriginal>({ e: events });
  const on = vi.fn(() => eventRef);
  const source = strictProxy<TestEventSource>({ on });
  return {
    eventRef,
    offref,
    on,
    source
  };
}

describe('subscribeEvent', () => {
  it('should register the handler via events.on and return the EventRef', () => {
    const {
      eventRef,
      on,
      source
    } = createMocks();
    const callback = vi.fn();

    const result = subscribeEvent({
      callback,
      events: source,
      name: 'my-event'
    });

    expect(on).toHaveBeenCalledWith('my-event', expect.any(Function), undefined);
    expect(result).toBe(eventRef);
  });
});

describe('subscribeDisposableEvent', () => {
  it('should return a DisposableEx that offrefs the EventRef on dispose', () => {
    const {
      eventRef,
      offref,
      source
    } = createMocks();
    const callback = vi.fn();

    const disposable = subscribeDisposableEvent({
      callback,
      events: source,
      name: 'my-event'
    });

    expect(offref).not.toHaveBeenCalled();
    disposable.dispose();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });
});

describe('EventRefDisposable', () => {
  it('should offref the EventRef once on dispose (idempotent)', () => {
    const {
      eventRef,
      offref
    } = createMocks();
    const disposable = new EventRefDisposable(eventRef);

    disposable.dispose();
    disposable.dispose();

    expect(offref).toHaveBeenCalledTimes(1);
    expect(offref).toHaveBeenCalledWith(eventRef);
  });

  it('should offref the EventRef via Symbol.dispose', () => {
    const {
      eventRef,
      offref
    } = createMocks();
    const disposable = new EventRefDisposable(eventRef);

    disposable[Symbol.dispose]();

    expect(offref).toHaveBeenCalledWith(eventRef);
  });
});
