# Testing

## Async-operation tracking

Fire-and-forget async operations scheduled via `invokeAsyncSafely` / `convertAsyncToSync` are not awaitable from a test by default, which makes assertions that depend on them flaky. `Obsidian Dev Utils` can **track** those operations so a test can drain them deterministically with `waitForAllAsyncOperations()`.

Tracking is opt-in — disabled by default, so production code carries no bookkeeping overhead. Enable it in your test suite with one of these setup endpoints. Each resets the shared state and enables tracking before each test, then disables tracking after each test, so neither state nor operations leak between tests:

- **Vitest** — `obsidian-dev-utils/vitest-setup`
- **Jest** — `obsidian-dev-utils/jest-setup`
- **Any framework (agnostic)** — `obsidian-dev-utils/setup`

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['obsidian-dev-utils/vitest-setup']
  }
});
```

### Jest

`beforeEach` / `afterEach` are only available after the test framework is installed, so use `setupFilesAfterEnv` (not `setupFiles`):

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  setupFilesAfterEnv: ['obsidian-dev-utils/jest-setup']
};

export default config;
```

### Other frameworks

The agnostic endpoint registers the hooks you hand it, so any framework that exposes `beforeEach` / `afterEach` works:

```typescript
import { setup } from 'obsidian-dev-utils/setup';
import {
  afterEach,
  beforeEach
} from 'your-test-framework';

setup({ afterEach, beforeEach });
```

### Using it in a test

Once a setup endpoint is wired in, await the tracked operations wherever you need them to settle:

```typescript
import { waitForAllAsyncOperations } from 'obsidian-dev-utils/async';

it('drains fire-and-forget work before asserting', async () => {
  doSomethingThatSchedulesFireAndForgetWork();
  await waitForAllAsyncOperations();
  expect(sideEffect).toBe(expected);
});
```

Operations scheduled while awaiting are also awaited, so cascading fire-and-forget chains are fully drained. Calling `waitForAllAsyncOperations()` without tracking enabled throws, rather than silently resolving and masking a missing setup.

## Unhandled async errors

The same per-test setup fails a test if a fire-and-forget async operation emitted an async error that no consumer handler was there to receive. After each test it first drains the tracked fire-and-forget operations (so any that reject emit their async error), then — if any async error was emitted while no handler registered via `registerAsyncErrorEventHandler` was active — throws an `AggregateError` listing them, failing the test. This is **not** opt-in: wiring in any setup endpoint enables it.

An async error counts as *handled* (and is never reported) whenever a consumer handler is registered at the moment it is emitted, mirroring Node's `unhandledRejection` model — registering a handler means you have taken responsibility for async errors. So a test that already asserts on an emitted async error through a registered handler needs no changes.

When a test deliberately triggers an async error with no consumer handler registered — for example exercising a fire-and-forget error path — open an ignore context with `startAsyncErrorIgnoreContext()` so the harness does not fail the test. A fire-and-forget operation *scheduled* within the context is ignored even when its rejection settles later (the schedule-time context is captured), so no manual draining is required:

```typescript
import { startAsyncErrorIgnoreContext } from 'obsidian-dev-utils/error';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';

it('swallows the rejection without throwing synchronously', () => {
  using _ignore = startAsyncErrorIgnoreContext();
  invokeAsyncSafely(() => Promise.reject(new Error('deliberately swallowed')));
});
```

Only operations scheduled *inside* the context are ignored — an operation scheduled outside it is still reported, even if another was ignored:

```typescript
it('still fails on an unignored rejection', () => {
  (() => {
    using _ignore = startAsyncErrorIgnoreContext();
    invokeAsyncSafely(() => Promise.reject(new Error('ignored')));
  })();

  invokeAsyncSafely(() => Promise.reject(new Error('reported — fails the test')));
});
```

## Silenced console output

The same per-test setup replaces every `console` method with a no-op before each test and restores the originals afterward, so incidental `console.log` / `warn` / `error` output does not pollute the test report. A test that needs to assert on console output re-instruments the method it cares about — the spy transparently overrides the no-op:

```typescript
import { vi } from 'vitest';

it('logs an error', () => {
  const errorSpy = vi.spyOn(console, 'error');
  doSomethingThatLogs();
  expect(errorSpy).toHaveBeenCalledWith('boom');
});
```

## `localStorage` in tests

Node 22+ exposes an experimental Web Storage `localStorage`, but it is unavailable (and emits an `ExperimentalWarning`) unless node is started with `--localstorage-file`. Real Obsidian (Electron) always has `localStorage`, so when you run tests through the `Obsidian Dev Utils` runner (the `test` script backed by `exec`), it automatically appends `--localstorage-file=:memory:` to `NODE_OPTIONS` for every spawned process — but only when the running node actually supports the flag. This gives each worker a working, non-persistent `localStorage` (no file on disk, no state shared between processes), and the per-test setup clears it before each test. If you launch `vitest` directly, bypassing the runner, pass the flag yourself:

```shell
NODE_OPTIONS=--localstorage-file=:memory: vitest
```

## Warnings as errors

The standard per-test setup also turns any Node process warning (`ExperimentalWarning`, `DeprecationWarning`, `MaxListenersExceededWarning`, …) into a test failure, so warnings get fixed at the source instead of scrolling past unread. This is **not** opt-in — wiring in any of the setup endpoints above (`vitest-setup`, `jest-setup`, or the agnostic `setup`) enables it automatically.

Because a run that does not provide `localStorage` emits an `ExperimentalWarning`, this pairs with the `--localstorage-file` behavior above: launch tests through the `Obsidian Dev Utils` runner (which supplies the flag) or set `NODE_OPTIONS=--localstorage-file=:memory:` yourself. If you need the guard elsewhere, call `installWarningsAsErrors()` from `obsidian-dev-utils/script-utils/warnings-as-errors` directly.
