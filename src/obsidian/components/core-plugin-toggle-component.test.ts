import type {
  InternalPlugin,
  InternalPlugins
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  EventRef
} from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { startAsyncErrorIgnoreContext } from '../../error.ts';
import { noopAsync } from '../../function.ts';
import { castTo } from '../../object-utils.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { CorePluginToggleComponent } from './core-plugin-toggle-component.ts';

interface CorePluginStub {
  enabled: boolean;
}

interface MockApp {
  readonly app: App;
  readonly corePlugin: CorePluginStub;
  readonly offref: ReturnType<typeof vi.fn>;
  toggle: (isEnabled: boolean) => void;
  triggerChange: () => void;
}

function createMockApp(isEnabled: boolean, hasCorePlugin = true): MockApp {
  const corePlugin: CorePluginStub = { enabled: isEnabled };
  const callbacks: (() => void)[] = [];
  const offref = vi.fn();

  function triggerChange(): void {
    for (const callback of callbacks) {
      callback();
    }
  }

  const app = strictProxy<App>({
    internalPlugins: strictProxy<InternalPlugins>({
      getPluginById: castTo<InternalPlugins['getPluginById']>(vi.fn(() => hasCorePlugin ? castTo<InternalPlugin<unknown>>(corePlugin) : null)),
      on: castTo<InternalPlugins['on']>((_name: string, callback: () => void): EventRef => {
        callbacks.push(callback);
        // eslint-disable-next-line unicorn/name-replacements -- Obsidian's EventRef shape names its emitter `e`, which Component.unload reads.
        return castTo<EventRef>({ e: { offref } });
      })
    })
  });

  return {
    app,
    corePlugin,
    offref,
    toggle(isNowEnabled: boolean): void {
      corePlugin.enabled = isNowEnabled;
      triggerChange();
    },
    triggerChange
  };
}

describe('CorePluginToggleComponent', () => {
  it('should call onEnable on load when the core plugin is already enabled', () => {
    const { app } = createMockApp(true);
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    new CorePluginToggleComponent({ app, corePluginId: 'canvas', onDisable, onEnable }).load();
    expect(onEnable).toHaveBeenCalledOnce();
    expect(onDisable).not.toHaveBeenCalled();
  });

  it('should not call onEnable on load when the core plugin is disabled', () => {
    const { app } = createMockApp(false);
    const onEnable = vi.fn();
    new CorePluginToggleComponent({ app, corePluginId: 'canvas', onEnable }).load();
    expect(onEnable).not.toHaveBeenCalled();
  });

  it('should call the handlers only on the edges of the enabled flag', () => {
    const mock = createMockApp(false);
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onDisable, onEnable }).load();

    mock.triggerChange();
    expect(onEnable).not.toHaveBeenCalled();

    mock.toggle(true);
    expect(onEnable).toHaveBeenCalledOnce();

    mock.triggerChange();
    expect(onEnable).toHaveBeenCalledOnce();

    mock.toggle(false);
    expect(onDisable).toHaveBeenCalledOnce();

    mock.triggerChange();
    expect(onDisable).toHaveBeenCalledOnce();
  });

  it('should tolerate missing handlers', () => {
    const mock = createMockApp(true);
    new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas' }).load();
    expect(() => {
      mock.toggle(false);
      mock.toggle(true);
    }).not.toThrow();
  });

  it('should register nothing when the core plugin is unknown', () => {
    const mock = createMockApp(true, false);
    const onEnable = vi.fn();
    const component = new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onEnable, shouldCallOnDisableOnUnload: true });
    component.load();
    component.unload();
    expect(onEnable).not.toHaveBeenCalled();
    expect(mock.offref).not.toHaveBeenCalled();
  });

  it('should not call onDisable on unload by default', () => {
    const mock = createMockApp(true);
    const onDisable = vi.fn();
    const component = new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onDisable });
    component.load();
    component.unload();
    expect(onDisable).not.toHaveBeenCalled();
    expect(mock.offref).toHaveBeenCalledOnce();
  });

  it('should call onDisable on unload when asked and the core plugin is enabled', () => {
    const mock = createMockApp(true);
    const onDisable = vi.fn();
    const component = new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onDisable, shouldCallOnDisableOnUnload: true });
    component.load();
    component.unload();
    expect(onDisable).toHaveBeenCalledOnce();
  });

  it('should not call onDisable on unload when asked but the core plugin is disabled', () => {
    const mock = createMockApp(true);
    const onDisable = vi.fn();
    const component = new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onDisable, shouldCallOnDisableOnUnload: true });
    component.load();
    mock.toggle(false);
    component.unload();
    expect(onDisable).toHaveBeenCalledOnce();
  });

  it('should report a rejecting handler without throwing from the event', async () => {
    using _ = startAsyncErrorIgnoreContext();
    const mock = createMockApp(false);
    const onEnable = vi.fn(async () => {
      await noopAsync();
      throw new Error('boom');
    });
    new CorePluginToggleComponent({ app: mock.app, corePluginId: 'canvas', onEnable }).load();
    expect(() => {
      mock.toggle(true);
    }).not.toThrow();
    expect(onEnable).toHaveBeenCalledOnce();
    await noopAsync();
  });
});
