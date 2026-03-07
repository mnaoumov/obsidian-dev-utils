/**
 * @packageDocumentation
 *
 * Lint fix script.
 */

import { lint } from '../src/ScriptUtils/linters/eslint/ESLint.ts';

await lint(true);
