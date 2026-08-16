---
title: Testing
description: Async-operation tracking, unhandled-error surfacing, vitest configuration, and integration-test helpers.
---

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

## Plugin vitest configuration

An Obsidian plugin's vitest setup is the same in every repo — a `unit-tests` project against mocked Obsidian plus an `integration-tests:*` family against a real one. `defineObsidianPluginVitestConfig` owns that whole shape, so a plugin's config is one call:

```typescript
// scripts/vitest-config.ts
import { defineObsidianPluginVitestConfig } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';

export const config = defineObsidianPluginVitestConfig();
```

It declares five projects, each collecting its own suffix:

| Project                                 | Collects                                                            |
|-----------------------------------------|---------------------------------------------------------------------|
| `unit-tests`                            | `*.test.ts` (minus every `*.integration.test.ts`), in `jsdom`        |
| `integration-tests:no-app`              | `*.no-app.integration.test.ts` — no Obsidian instance at all         |
| `integration-tests:desktop`             | `*.desktop.integration.test.ts` + `*.cross-platform.integration.test.ts` |
| `integration-tests:desktop-performance` | `*.desktop-performance.integration.test.ts`                          |
| `integration-tests:android`             | `*.android.integration.test.ts` + `*.cross-platform.integration.test.ts` |

A behavior that must hold on **both** platforms therefore lives in exactly one `*.cross-platform.integration.test.ts` file with plain top-level `describe` / `it` — both platform projects collect it and run it under their own transport. A behavior specific to one platform stays in a single `*.desktop.` or `*.android.` file. Neither needs a wrapper function or a per-platform entry point.

Set `OBSIDIAN_VERSION` to pin the desktop project to a specific Obsidian (for example `OBSIDIAN_VERSION=catalyst-latest`); when it is unset, no version is pinned and the installed Obsidian runs as-is.

Customize through the two hooks — `editContext` edits the standard projects in place, `customProjects` appends projects the base does not know about:

```typescript
export const config = defineObsidianPluginVitestConfig({
  customProjects(context) {
    return [{
      test: {
        environment: 'node',
        fileParallelism: false,
        globalSetup: ['./scripts/demo-vault-global-setup.ts'],
        hookTimeout: context.bigTimeoutInMilliseconds * context.hookTimeoutMultiplier,
        include: ['src/**/*.demo-vault.integration.test.ts'],
        name: 'integration-tests:demo-vault',
        setupFiles: ['obsidian-integration-testing/vitest-setup'],
        testTimeout: context.bigTimeoutInMilliseconds
      }
    }];
  },
  editContext(context) {
    context.desktopPerformance.globalSetup = ['./scripts/vitest-global-setup-performance.ts'];
    context.coverageExclude.push('src/**/*.d.ts');
  }
});
```

Everything the context exposes is live — the arrays and objects it hands you are the ones the final configuration is built from.

That `integration-tests:demo-vault` project is written out in full above to show what `customProjects` can declare; a project that drives a real desktop Obsidian is shorter written as `...context.desktop` plus its own `globalSetup` and `include`. See [Clicking every button](/obsidian-dev-utils/guides/demo-vault/#clicking-every-button) for the whole three-part wiring — the project, its global setup, and the suite that uses them — and note that declaring a project here is only half the job: `scripts/test-integration.ts` has to list it too, or nothing ever runs it.

## Integration tests: reaching library helpers inside `evalInObsidian`

[`obsidian-integration-testing`](https://github.com/mnaoumov/obsidian-integration-testing) runs a closure inside a real Obsidian, and injects a `lib` bag into it. `Obsidian Dev Utils` can merge its **entire** helper surface into that bag, so a serialized closure — which cannot use imports — reaches any helper as `lib.<helper>`:

```typescript
await evalInObsidian({
  async callback({ app, lib: { ensureMetadataCacheReady } }) {
    await ensureMetadataCacheReady(app);
  }
});
```

Three pieces make that work, and **all three are required** — the runtime without the types leaves `lib.<helper>` unable to compile, and the types without the runtime leaves it `undefined` at run time.

### 1. Global setup — put the library in the test vault

The helpers are published by a tiny harness plugin that this package ships. It has to be installed in the test vault **alongside** your own plugin, so replace `obsidian-integration-testing/vitest-global-setup-plugin` with the drop-in below (do not list both):

```typescript
// vitest.config.ts (each integration-test project)
globalSetup: ['obsidian-dev-utils/integration-test-vitest-global-setup'],
```

It does everything the harness's own global setup does — temp vault, install and enable your plugin — and additionally seeds and enables the harness plugin.

If a project already needs its own `populate` (demo-vault fixtures, a large performance vault), compose instead of replacing:

```typescript
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  getIntegrationTestPluginPopulate,
  OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID
} from 'obsidian-dev-utils/script-utils/test-runners/integration-test-plugin';

export const { setup, teardown } = createSetup({
  enableCommunityPlugins: [OBSIDIAN_DEV_UTILS_INTEGRATION_TEST_PLUGIN_ID],
  populate: () => ({ ...myFixtures(), ...getIntegrationTestPluginPopulate() })
});
```

### 2. Setup file — register the resolver

```typescript
// vitest.config.ts (each integration-test project)
setupFiles: [
  'obsidian-integration-testing/vitest-setup',
  'obsidian-dev-utils/integration-test-setup'
],
```

Importing `obsidian-dev-utils/integration-test-setup` registers a renderer-side resolver whose result the harness merges into `lib`. Registration is idempotent, so naming it from more than one setup file is safe.

### 3. A triple-slash reference — activate the types

Add one line to a `.d.ts` your `tsconfig.json` already includes (e.g. `src/obsidian-dev-utils-lib.d.ts`):

```typescript
/// <reference types="obsidian-dev-utils/@types/obsidian-integration-testing" />
```

This is what augments the harness's `Lib` interface with the library's flat surface. Without it, `lib.<helper>` fails to compile with `TS2339: Property '<helper>' does not exist on type 'Lib'`.

Use the reference, **not** a `compilerOptions.types` entry: a `types` entry naming the same path resolves without complaint but does not bring the module augmentation into the program, so `lib.<helper>` still fails to compile. (Verified against `moduleResolution: node16`.)

The `lib` bag is **flat** — every helper sits at the top level (`lib.ensureMetadataCacheReady`, not `lib.obsidian['metadata-cache'].ensureMetadataCacheReady`). Note that the harness plugin carries its own copy of the library, loaded only in the throwaway test vault; your plugin's own bundle is untouched.

## Warnings as errors

The standard per-test setup also turns any Node process warning (`ExperimentalWarning`, `DeprecationWarning`, `MaxListenersExceededWarning`, …) into a test failure, so warnings get fixed at the source instead of scrolling past unread. This is **not** opt-in — wiring in any of the setup endpoints above (`vitest-setup`, `jest-setup`, or the agnostic `setup`) enables it automatically.

Because a run that does not provide `localStorage` emits an `ExperimentalWarning`, this pairs with the `--localstorage-file` behavior above: launch tests through the `Obsidian Dev Utils` runner (which supplies the flag) or set `NODE_OPTIONS=--localstorage-file=:memory:` yourself. If you need the guard elsewhere, call `installWarningsAsErrors()` from `obsidian-dev-utils/script-utils/warnings-as-errors` directly.
