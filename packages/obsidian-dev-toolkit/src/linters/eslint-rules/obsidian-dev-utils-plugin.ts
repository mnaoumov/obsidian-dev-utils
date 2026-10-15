/**
 * @file
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { genericInHouseEslintRules } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/in-house-plugin';

import { manifestDescription } from './manifest-description.ts';
import { manifestId } from './manifest-id.ts';
import { manifestName } from './manifest-name.ts';
import { manifestSchema } from './manifest-schema.ts';
import { noOverCapWaitInEvalInObsidian } from './no-over-cap-wait-in-eval-in-obsidian.ts';
import { noUntrustedInputEvents } from './no-untrusted-input-events.ts';
import { requireComponentSuffix } from './require-component-suffix.ts';

/**
 * ESLint plugin bundling every `obsidian-dev-utils` custom rule, registered under the `obsidian-dev-utils` namespace:
 * the generic rules of `@mnaoumov/typescript-dev-toolkit` and the Obsidian ones. It is ONE plugin carrying both,
 * because ESLint refuses two different plugins under one namespace.
 */
export const obsidianDevUtilsPlugin: ESLint.Plugin = {
  rules: {
    ...genericInHouseEslintRules,
    'manifest-description': manifestDescription,
    'manifest-id': manifestId,
    'manifest-name': manifestName,
    'manifest-schema': manifestSchema,
    'no-over-cap-wait-in-eval-in-obsidian': noOverCapWaitInEvalInObsidian,
    'no-untrusted-input-events': noUntrustedInputEvents,
    'require-component-suffix': requireComponentSuffix
  }
};
