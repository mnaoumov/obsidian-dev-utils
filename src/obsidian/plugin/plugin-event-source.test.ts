/**
 * @file
 *
 * Tests for the plugin event source.
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AsyncEventRef } from '../../async-events.ts';
import type { PluginBase } from './plugin.ts';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { PluginEventSourceImpl } from './plugin-event-source.ts';

describe('PluginEventSourceImpl', () => {
  let eventSource: PluginEventSourceImpl;
  const mockOff = vi.fn();
  const mockOffref = vi.fn();
  const mockOn = vi.fn();
  const mockOnce = vi.fn();

  beforeEach(() => {
    const plugin = strictProxy<PluginBase>({
      off: mockOff,
      offref: mockOffref,
      on: mockOn,
      once: mockOnce
    });
    eventSource = new PluginEventSourceImpl(plugin);
  });

  it('should delegate off() to plugin', () => {
    const callback = vi.fn();
    eventSource.off('externalSettingsChange', callback);
    expect(mockOff).toHaveBeenCalledWith('externalSettingsChange', callback);
  });

  it('should delegate offref() to plugin', () => {
    const eventRef = strictProxy<AsyncEventRef>({});
    eventSource.offref(eventRef);
    expect(mockOffref).toHaveBeenCalledWith(eventRef);
  });

  it('should delegate on() to plugin', () => {
    const callback = vi.fn();
    const expectedRef = strictProxy<AsyncEventRef>({});
    mockOn.mockReturnValue(expectedRef);

    const result = eventSource.on('externalSettingsChange', callback);

    expect(mockOn).toHaveBeenCalledWith('externalSettingsChange', callback, undefined);
    expect(result).toBe(expectedRef);
  });

  it('should delegate on() with thisArg to plugin', () => {
    const callback = vi.fn();
    const thisArg = { context: true };
    const expectedRef = strictProxy<AsyncEventRef>({});
    mockOn.mockReturnValue(expectedRef);

    const result = eventSource.on('externalSettingsChange', callback, thisArg);

    expect(mockOn).toHaveBeenCalledWith('externalSettingsChange', callback, thisArg);
    expect(result).toBe(expectedRef);
  });

  it('should delegate once() to plugin', () => {
    const callback = vi.fn();
    const expectedRef = strictProxy<AsyncEventRef>({});
    mockOnce.mockReturnValue(expectedRef);

    const result = eventSource.once('externalSettingsChange', callback);

    expect(mockOnce).toHaveBeenCalledWith('externalSettingsChange', callback, undefined);
    expect(result).toBe(expectedRef);
  });

  it('should delegate once() with thisArg to plugin', () => {
    const callback = vi.fn();
    const thisArg = { context: true };
    const expectedRef = strictProxy<AsyncEventRef>({});
    mockOnce.mockReturnValue(expectedRef);

    const result = eventSource.once('externalSettingsChange', callback, thisArg);

    expect(mockOnce).toHaveBeenCalledWith('externalSettingsChange', callback, thisArg);
    expect(result).toBe(expectedRef);
  });
});
