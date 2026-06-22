/**
 * @file
 *
 * Tests for {@link EmbedExtensionsComponent}.
 */

import type { EmbedCreator } from '@obsidian-typings/obsidian-public-latest';
import type { App as AppOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../strict-proxy.ts';
import { EmbedExtensionsComponent } from './embed-extensions-component.ts';

interface Mocks {
  app: AppOriginal;
  registerExtensions: ReturnType<typeof vi.fn>;
  unregisterExtensions: ReturnType<typeof vi.fn>;
}

describe('EmbedExtensionsComponent', () => {
  it('should register extensions with the embed registry after loading', () => {
    const { app, registerExtensions } = createMocks();
    const component = new EmbedExtensionsComponent(app);
    component.load();
    const registerSpy = vi.spyOn(component, 'register');
    const embedCreator = vi.fn<EmbedCreator>();

    component.registerExtensions(['ext1', 'ext2'], embedCreator);

    expect(registerExtensions).toHaveBeenCalledWith(['ext1', 'ext2'], embedCreator);
    expect(registerSpy).toHaveBeenCalledOnce();
  });

  it('should unregister the extensions when unloaded', () => {
    const { app, unregisterExtensions } = createMocks();
    const component = new EmbedExtensionsComponent(app);
    component.load();

    component.registerExtensions(['ext1', 'ext2'], vi.fn<EmbedCreator>());
    expect(unregisterExtensions).not.toHaveBeenCalled();

    component.unload();

    expect(unregisterExtensions).toHaveBeenCalledWith(['ext1', 'ext2']);
  });

  it('should throw when registering extensions before the component is loaded', () => {
    const { app, registerExtensions } = createMocks();
    const component = new EmbedExtensionsComponent(app);

    expect(() => {
      component.registerExtensions(['ext1'], vi.fn<EmbedCreator>());
    }).toThrow('Component is not loaded');
    expect(registerExtensions).not.toHaveBeenCalled();
  });
});

function createMocks(): Mocks {
  const registerExtensions = vi.fn();
  const unregisterExtensions = vi.fn();

  const app = strictProxy<AppOriginal>({
    embedRegistry: {
      registerExtensions,
      unregisterExtensions
    }
  });

  return { app, registerExtensions, unregisterExtensions };
}
