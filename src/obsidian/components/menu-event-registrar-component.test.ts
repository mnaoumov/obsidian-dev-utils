/**
 * @file
 *
 * Tests for {@link MenuEventRegistrarComponent}.
 */

import type {
  App as AppOriginal,
  EventRef as EventRefOriginal,
  Events as EventsOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../strict-proxy.ts';
import { MenuEventRegistrarComponent } from './menu-event-registrar-component.ts';

interface Mocks {
  app: AppOriginal;
  eventRef: EventRefOriginal;
  offref: ReturnType<typeof vi.fn>;
  registeredEvents: string[];
}

function createMocks(): Mocks {
  const registeredEvents: string[] = [];
  const offref = vi.fn();
  const events = strictProxy<EventsOriginal>({ offref });
  const eventRef = strictProxy<EventRefOriginal>({ e: events });

  const app = strictProxy<AppOriginal>({
    workspace: {
      on: vi.fn((event: string) => {
        registeredEvents.push(event);
        return eventRef;
      })
    }
  });

  return {
    app,
    eventRef,
    offref,
    registeredEvents
  };
}

describe('MenuEventRegistrarComponent', () => {
  it('should register editor-menu event and return a disposable that offrefs it', () => {
    const {
      app,
      eventRef,
      offref,
      registeredEvents
    } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();

    const disposable = registrar.registerEditorMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('editor-menu');
    expect(offref).not.toHaveBeenCalled();
    disposable.dispose();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });

  it('should register file-menu event and return a disposable that offrefs it', () => {
    const {
      app,
      eventRef,
      offref,
      registeredEvents
    } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();

    const disposable = registrar.registerFileMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('file-menu');
    disposable.dispose();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });

  it('should register files-menu event and return a disposable that offrefs it', () => {
    const {
      app,
      eventRef,
      offref,
      registeredEvents
    } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();

    const disposable = registrar.registerFilesMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('files-menu');
    disposable.dispose();
    expect(offref).toHaveBeenCalledWith(eventRef);
  });

  it('should offref every registered menu event on component unload', () => {
    const {
      app,
      offref
    } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();

    registrar.registerEditorMenuEventHandler(vi.fn());
    registrar.registerFileMenuEventHandler(vi.fn());
    registrar.unload();

    expect(offref).toHaveBeenCalledTimes(2);
  });

  it('should throw when registering a handler before the component is loaded', () => {
    const { app } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);

    expect(() => {
      registrar.registerEditorMenuEventHandler(vi.fn());
    }).toThrow('Component is not loaded');
    expect(() => {
      registrar.registerFileMenuEventHandler(vi.fn());
    }).toThrow('Component is not loaded');
    expect(() => {
      registrar.registerFilesMenuEventHandler(vi.fn());
    }).toThrow('Component is not loaded');
  });
});
