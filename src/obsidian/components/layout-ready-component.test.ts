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

import { noop } from '../../function.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { AllWindowsEventComponent } from './all-windows-event-component.ts';
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

  it('should not invoke onLayoutReady when unloaded while the async load is still in flight', async () => {
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
    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    // The async load is still gated, so the layout-ready handler is parked awaiting it.
    expect(order).toEqual([]);

    // Unload before the load settles, so `_loaded` is false once the in-flight promise resolves.
    component.unload();
    openLoadGate();
    await vi.runAllTimersAsync();

    // OnLayoutReady is skipped because the component was unloaded during the in-flight load.
    expect(order).toEqual(['onloadAsync']);
    vi.useRealTimers();
  });

  it('should not invoke onLayoutReady when the in-flight async load fails', async () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const order: string[] = [];
    let openLoadGate!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      openLoadGate = resolve;
    });

    class FailingAsyncLoadLayoutReadyComponent extends LayoutReadyComponent {
      public override async onloadAsync(): Promise<void> {
        await loadGate;
        order.push('onloadAsync');
        throw new Error('load failed');
      }

      protected override onLayoutReady(): void {
        order.push('onLayoutReady');
      }
    }

    const component = new FailingAsyncLoadLayoutReadyComponent(app);
    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    // The async load is still gated, so the layout-ready handler is parked awaiting it.
    expect(order).toEqual([]);

    // Let the load settle with a failure.
    openLoadGate();
    await vi.runAllTimersAsync();

    // OnLayoutReady is skipped because the async load failed, not just because it is unfinished.
    expect(order).toEqual(['onloadAsync']);
    vi.useRealTimers();
  });

  it('should not invoke onLayoutReady when the load already failed before the handler runs', async () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const order: string[] = [];

    class AlreadyFailedLoadLayoutReadyComponent extends LayoutReadyComponent {
      public override onloadAsync(): Promise<void> {
        order.push('onloadAsync');
        return Promise.reject(new Error('load failed'));
      }

      protected override onLayoutReady(): void {
        order.push('onLayoutReady');
      }
    }

    const component = new AlreadyFailedLoadLayoutReadyComponent(app);
    // The rejection settles (recording the error and clearing the in-flight promise) before the setTimeout(0)
    // Handler runs, so it takes the no-in-flight-promise branch with a recorded failure.
    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    // OnLayoutReady is skipped: no in-flight load remains, but the load failed.
    expect(order).toEqual(['onloadAsync']);
    vi.useRealTimers();
  });

  it('should quietly abandon an onLayoutReady that resumes after the component was unloaded', async () => {
    vi.useFakeTimers();
    const { app, triggerLayoutReady } = createMockApp();
    const order: string[] = [];
    let openWorkGate!: () => void;
    const workGate = new Promise<void>((resolve) => {
      openWorkGate = resolve;
    });

    class SlowLayoutReadyComponent extends LayoutReadyComponent {
      protected override async onLayoutReady(): Promise<void> {
        order.push('started');
        await workGate;
        order.push('resumed');
        this.addChild(new AllWindowsEventComponent(this.app)).registerAllDocumentsDomEvent({
          callback: noop,
          options: { capture: true },
          type: 'change'
        });
        order.push('registered');
      }
    }

    const component = new SlowLayoutReadyComponent(app);
    component.load();
    triggerLayoutReady();
    await vi.runAllTimersAsync();

    // The handler started and is suspended on the gate, exactly as a long-running plugin onLayoutReady is.
    expect(order).toEqual(['started']);

    // Models a plugin update/reload: the component is unloaded while the handler is still suspended.
    component.unload();
    openWorkGate();
    await vi.runAllTimersAsync();

    // The resumed body unwinds at addChild with a SilentError, so the registration never happens and no
    // Unhandled async error is emitted — the shared setup fails the test if one were.
    expect(order).toEqual(['started', 'resumed']);
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
