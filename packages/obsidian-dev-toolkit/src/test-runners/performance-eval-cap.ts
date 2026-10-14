/**
 * @file
 *
 * The per-eval cap of the `integration-tests:desktop-performance` project, and the file suffix that
 * project collects.
 *
 * Both live here, rather than in `vitest-config.ts`, because the `no-over-cap-wait-in-eval-in-obsidian`
 * ESLint rule reads them too, and the shared ESLint config loads that rule in every consuming repo:
 * importing `vitest-config.ts` from the rule would load `vitest/config` at lint time for nothing.
 */

/**
 * The per-eval cap the `integration-tests:desktop-performance` project gives its CDP transport, in
 * milliseconds.
 *
 * Every other project keeps the transport's own `DEFAULT_EVAL_CAP_IN_MILLISECONDS` (30 000), and a repo
 * that raises its desktop cap above that is setting a BACKSTOP, not a budget a closure may spend. The
 * performance project is the one exception, and a deliberate one: its whole measurement is one long
 * in-page `Runtime.evaluate` over a vault of tens of thousands of notes, and its files run on no other
 * project. A cross-platform suite gains nothing from any desktop raise, because Appium caps it at
 * 30 000 whatever the desktop project says.
 */
export const PERFORMANCE_EVAL_CAP_IN_MILLISECONDS = 600_000;

/**
 * The file-name suffix of a suite the `integration-tests:desktop-performance` project collects.
 */
export const DESKTOP_PERFORMANCE_TEST_FILE_SUFFIX = '.desktop-performance.integration.test.ts';
