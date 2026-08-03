/**
 * @file
 *
 * Tests for {@link subscribeEvent}, {@link subscribeDisposableEvent}, and {@link EventRefDisposable}.
 */

import type {
  EventRef as EventReferenceOriginal,
  Events as EventsOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { dispose } from '../disposable.ts';
import { strictProxy } from '../strict-proxy.ts';
import {
  EventRefDisposable as EventReferenceDisposable,
  subscribeDisposableEvent,
  subscribeEvent
} from './events.ts';

interface Mocks {
  eventReference: EventReferenceOriginal;
  offref: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  source: TestEventSource;
}

// A minimal typed event source: extends the base `Events` (one `on` overload) plus one concrete overload — small
// Enough to avoid the deep-instantiation limit that the real `Workspace` (27 overloads) would hit.
interface TestEventSource extends EventsOriginal {
  on(name: 'my-event', callback: (value: number) => void): EventReferenceOriginal;
}

function createMocks(): Mocks {
  const offref = vi.fn();
  const events = strictProxy<EventsOriginal>({ offref });
  const eventReference = strictProxy<EventReferenceOriginal>({ e: events });
  const on = vi.fn(() => eventReference);
  const source = strictProxy<TestEventSource>({ on });
  return {
    eventReference,
    offref,
    on,
    source
  };
}

describe('subscribeEvent', () => {
  it('should register the handler via events.on and return the EventRef', () => {
    const {
      eventReference,
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
    expect(result).toBe(eventReference);
  });
});

describe('subscribeDisposableEvent', () => {
  it('should return a DisposableEx that offrefs the EventRef on dispose', () => {
    const {
      eventReference,
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
    expect(offref).toHaveBeenCalledWith(eventReference);
  });
});

describe('EventRefDisposable', () => {
  it('should offref the EventRef once on dispose (idempotent)', () => {
    const {
      eventReference,
      offref
    } = createMocks();
    const disposable = new EventReferenceDisposable(eventReference);

    disposable.dispose();
    disposable.dispose();

    expect(offref).toHaveBeenCalledTimes(1);
    expect(offref).toHaveBeenCalledWith(eventReference);
  });

  it('should offref the EventRef via Symbol.dispose', () => {
    const {
      eventReference,
      offref
    } = createMocks();
    const disposable = new EventReferenceDisposable(eventReference);

    dispose(disposable);

    expect(offref).toHaveBeenCalledWith(eventReference);
  });
});
