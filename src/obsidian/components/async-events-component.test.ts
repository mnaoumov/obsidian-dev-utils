/**
 * @file
 *
 * Tests for {@link registerAsyncEvent}.
 */

import { Component } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AsyncEventRef } from '../../async-events.ts';

import { registerAsyncEvent } from './async-events-component.ts';

describe('registerAsyncEvent', () => {
  it('should call offref on the event source when the component unloads', () => {
    const component = new Component();
    component.load();

    const offref = vi.fn();
    const eventRef: AsyncEventRef = {
      asyncEventSource: { offref },
      callback: vi.fn(),
      name: 'test',
      thisArg: undefined
    };

    registerAsyncEvent(component, eventRef);

    expect(offref).not.toHaveBeenCalled();

    component.unload();

    expect(offref).toHaveBeenCalledWith(eventRef);
  });
});
