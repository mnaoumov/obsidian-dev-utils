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
