/**
 * @file
 *
 * Test setup file that turns Node process warnings into test failures.
 *
 * Add it to your test runner's `setupFiles` to fail the run whenever Node emits a warning (see
 * {@link installWarningsAsErrors}). It is framework-agnostic — it registers a process-level listener
 * and does not depend on Vitest or Jest — so the same file works for either runner. It is kept separate
 * from `vitest-setup.ts` / `jest-setup.ts` so it stays opt-in: adopting the standard per-test setup
 * does not silently make every existing warning a hard failure.
 */

/* v8 ignore start -- Thin setup-file glue; installWarningsAsErrors is unit-tested separately. */
import { installWarningsAsErrors } from './script-utils/warnings-as-errors.ts';

installWarningsAsErrors();
/* v8 ignore stop */
