/**
 * @packageDocumentation
 *
 * Lint markdown fix script.
 */

import { lint } from '../src/ScriptUtils/linters/markdownlint/markdownlint.ts';

await lint(true);
