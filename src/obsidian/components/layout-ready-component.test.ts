/**
 * @file
 *
 * Tests for {@link LayoutReadyComponent} and {@link CallbackLayoutReadyComponent}.
 */

import type { App as AppOriginal } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../strict-proxy.ts';
import {
  CallbackLayoutReadyComponent,
  LayoutReadyComponent
} from './layout-ready-component.ts';

interface MockApp {
  app: AppOriginal;
  triggerLayoutReady(): void;
}

function createMockApp(): MockApp {
  let layoutReadyCallback: (() => void) | undefined;

  const app = strictProxy<AppOriginal>({
    workspace: {
      onLayoutReady: vi.fn((cb: () => void) => {
        layoutReadyCallback = cb;
      })
    }
  });

  return {
    app,
    triggerLayoutReady: (): void => {
      layoutReadyCallback?.();
    }
  };
}

describe('LayoutReadyComponent', () => {
  it('should register layout ready handler on load', () => {
    const { app } = createMockApp();
    const component = new CallbackLayoutReadyComponent(app, vi.fn());

    component.load();

    expect(app.workspace.onLayoutReady).toHaveBeenCalledOnce();
  });

  it('should invoke onLayoutReady when layout becomes ready', () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const callback = vi.fn();
    const component = new CallbackLayoutReadyComponent(app, callback);

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should not invoke onLayoutReady if component is unloaded before setTimeout fires', () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const callback = vi.fn();
    const component = new CallbackLayoutReadyComponent(app, callback);

    component.load();
    triggerLayoutReady();
    component.unload();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should call base onLayoutReady (noop) without error when no override', () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const component = new LayoutReadyComponent(app);

    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(app.workspace.onLayoutReady).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('should wait for an in-flight async load before invoking onLayoutReady (loaded after layout is ready)', async () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const order: string[] = [];
    let openLoadGate!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      openLoadGate = resolve;
    });

    class AsyncLoadLayoutReadyComponent extends LayoutReadyComponent {
      public override async onloadAsync(): Promise<void> {
        await loadGate;
        order.push('onloadAsync');
      }

      protected override onLayoutReady(): void {
        order.push('onLayoutReady');
      }
    }

    const component = new AsyncLoadLayoutReadyComponent(app);
    // Load first, then signal layout-ready: models a component loaded after the layout was already ready, so
    // Its async load (onloadAsync) is still in flight when the layout-ready handler fires.
    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    // The async load is still gated, so onLayoutReady must not have run yet.
    expect(order).toEqual([]);

    openLoadGate();
    await vi.runAllTimersAsync();

    // OnLayoutReady runs only after onloadAsync settles — never racing ahead of it.
    expect(order).toEqual(['onloadAsync', 'onLayoutReady']);
    vi.useRealTimers();
  });

  it('should work with abstract subclass pattern', () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const onLayoutReadySpy = vi.fn();

    class TestLayoutReadyComponent extends LayoutReadyComponent {
      protected override onLayoutReady(): void {
        onLayoutReadySpy();
      }
    }

    const component = new TestLayoutReadyComponent(app);
    component.load();
    triggerLayoutReady();
    vi.runAllTimers();

    expect(onLayoutReadySpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
