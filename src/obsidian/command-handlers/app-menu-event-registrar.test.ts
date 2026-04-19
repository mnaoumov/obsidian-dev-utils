/**
 * @file
 *
 * Tests for {@link AppMenuEventRegistrar}.
 */

import type {
  App as AppOriginal,
  Component as ComponentOriginal,
  EventRef as EventRefOriginal
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../test-helpers/mock-implementation.ts';
import { AppMenuEventRegistrar } from './app-menu-event-registrar.ts';

interface Mocks {
  app: AppOriginal;
  component: ComponentOriginal;
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

  const component = strictProxy<ComponentOriginal>({
    registerEvent: vi.fn()
  });

  return { app, component, registeredEvents };
}

describe('AppMenuEventRegistrar', () => {
  it('should register editor-menu event', () => {
    const { app, component, registeredEvents } = createMocks();
    const registrar = new AppMenuEventRegistrar(app, component);

    registrar.registerEditorMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('editor-menu');
    expect(component.registerEvent).toHaveBeenCalledOnce();
  });

  it('should register file-menu event', () => {
    const { app, component, registeredEvents } = createMocks();
    const registrar = new AppMenuEventRegistrar(app, component);

    registrar.registerFileMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('file-menu');
    expect(component.registerEvent).toHaveBeenCalledOnce();
  });

  it('should register files-menu event', () => {
    const { app, component, registeredEvents } = createMocks();
    const registrar = new AppMenuEventRegistrar(app, component);

    registrar.registerFilesMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('files-menu');
    expect(component.registerEvent).toHaveBeenCalledOnce();
  });
});
