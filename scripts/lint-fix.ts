/**
 * @packageDocumentation
 *
 * Lint fix script.
 */

import { lint } from '../src/script-utils/linters/eslint/eslint.ts';

await lint(true);
