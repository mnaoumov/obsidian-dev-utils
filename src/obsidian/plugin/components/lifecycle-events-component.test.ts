import type { App as AppOriginal } from 'obsidian';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../../test-helpers/mock-implementation.ts';
import { LifecycleEventsComponent } from './lifecycle-events-component.ts';

let app: AppOriginal;
let layoutReadyCallback: (() => void) | undefined;

beforeEach(() => {
  layoutReadyCallback = undefined;
  app = strictProxy<AppOriginal>({
    workspace: {
      onLayoutReady: vi.fn((cb: () => void) => {
        layoutReadyCallback = cb;
      })
    }
  });
});

describe('LifecycleEventsComponent', () => {
  it('should trigger load event on onload', async () => {
    const component = new LifecycleEventsComponent(app);
    const callback = vi.fn();
    component.events.on('load', callback);

    await component.onload();

    expect(callback).toHaveBeenCalled();
  });

  it('should register layoutReady callback with workspace', async () => {
    const component = new LifecycleEventsComponent(app);
    const callback = vi.fn();
    component.events.on('layoutReady', callback);

    await component.onload();

    expect(app.workspace.onLayoutReady).toHaveBeenCalled();

    // Simulate layout ready
    if (layoutReadyCallback) {
      layoutReadyCallback();
    }

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });
  });

  it('should trigger unload event on onunload', async () => {
    const component = new LifecycleEventsComponent(app);
    await component.onload();

    const callback = vi.fn();
    component.events.on('unload', callback);

    component.onunload();

    // Wait for async invocation
    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });
  });

  it('should resolve waitForLifecycleEvent immediately if event already triggered', async () => {
    const component = new LifecycleEventsComponent(app);
    await component.triggerLifecycleEvent('load');

    // Should resolve immediately since 'load' was already triggered
    await component.waitForLifecycleEvent('load');
  });

  it('should wait for lifecycle event that has not yet been triggered', async () => {
    const component = new LifecycleEventsComponent(app);
    let resolved = false;

    const promise = component.waitForLifecycleEvent('load').then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    await component.triggerLifecycleEvent('load');
    await promise;

    expect(resolved).toBe(true);
  });

  it('should execute callback via registerForLifecycleEvent after event triggers', async () => {
    const component = new LifecycleEventsComponent(app);
    await component.triggerLifecycleEvent('load');

    const callback = vi.fn(async () => {
      await Promise.resolve();
    });

    await component.registerForLifecycleEvent('load', callback);

    expect(callback).toHaveBeenCalled();
  });
});
