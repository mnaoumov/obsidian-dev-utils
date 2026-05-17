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

import { strictProxy } from '../test-helpers/mock-implementation.ts';
import { MenuEventRegistrarComponent } from './components/AppMenuEventRegistrarComponent.ts';

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

describe('AppMenuEventRegistrar', () => {
  it('should register editor-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerEditorMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('editor-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
  });

  it('should register file-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerFileMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('file-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
  });

  it('should register files-menu event', () => {
    const { app, registeredEvents } = createMocks();
    const registrar = new MenuEventRegistrarComponent(app);
    const registerEventSpy = vi.spyOn(registrar, 'registerEvent');

    registrar.registerFilesMenuEventHandler(vi.fn());

    expect(registeredEvents).toContain('files-menu');
    expect(registerEventSpy).toHaveBeenCalledOnce();
  });
});
