/**
 * @packageDocumentation
 *
 * Lint markdown fix script.
 */

import { lint } from '../src/script-utils/linters/markdownlint/markdownlint.ts';

await lint(true);
