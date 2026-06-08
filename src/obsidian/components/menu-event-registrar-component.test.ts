/**
 * @file
 *
 * Tests for {@link MenuEventRegistrarComponent}.
 */

import type {
  App as AppOriginal,
  EventRef as EventRefOriginal
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
  registeredEvents: string[];
}

function createMocks(): Mocks {
  const registeredEvents: string[] = [];
  const mockEventRef = strictProxy<EventRefOriginal>({});

  const app = strictProxy<AppOriginal>({
    workspace: {
      on: vi.fn((event: string) => {
        registeredEvents.push(event);
        return mockEventRef;
      })
    }
  });

  return { app, registeredEvents };
}

describe('MenuEventRegistrarComponent', () => {
  it('should register editor-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerEditorMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('editor-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
  });

  it('should register file-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerFileMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('file-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
  });

  it('should register files-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    registrar.load();
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerFilesMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('files-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
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
