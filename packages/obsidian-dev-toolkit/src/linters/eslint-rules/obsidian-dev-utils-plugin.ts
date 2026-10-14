/**
 * @file
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { noAsyncCallbackToUnsafeReturn } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/no-async-callback-to-unsafe-return';
import { noUnresolvedJsdocLink } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/no-unresolved-jsdoc-link';
import { noUnusedParamsMembers } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/no-unused-params-members';
import { noUsedUnderscoreVariables } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/no-used-underscore-variables';
import { paramsOptionsNameMatch } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/params-options-name-match';
import { preferNoopAsync } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/prefer-noop-async';
import { readonlyParamsOptionsResultMembers } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/readonly-params-options-result-members';
import { requireMethodTemplate } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/require-method-template';
import { requireSuperCall } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/require-super-call';

import { manifestDescription } from './manifest-description.ts';
import { manifestId } from './manifest-id.ts';
import { manifestName } from './manifest-name.ts';
import { manifestSchema } from './manifest-schema.ts';
import { noOverCapWaitInEvalInObsidian } from './no-over-cap-wait-in-eval-in-obsidian.ts';
import { noUntrustedInputEvents } from './no-untrusted-input-events.ts';
import { requireComponentSuffix } from './require-component-suffix.ts';

/**
 * ESLint plugin bundling every `obsidian-dev-utils` custom rule, registered under the `obsidian-dev-utils` namespace.
 */
export const obsidianDevUtilsPlugin: ESLint.Plugin = {
  rules: {
    'manifest-description': manifestDescription,
    'manifest-id': manifestId,
    'manifest-name': manifestName,
    'manifest-schema': manifestSchema,
    'no-async-callback-to-unsafe-return': noAsyncCallbackToUnsafeReturn,
    'no-over-cap-wait-in-eval-in-obsidian': noOverCapWaitInEvalInObsidian,
    'no-unresolved-jsdoc-link': noUnresolvedJsdocLink,
    'no-untrusted-input-events': noUntrustedInputEvents,
    'no-unused-params-members': noUnusedParamsMembers,
    'no-used-underscore-variables': noUsedUnderscoreVariables,
    'params-options-name-match': paramsOptionsNameMatch,
    'prefer-noop-async': preferNoopAsync,
    'readonly-params-options-result-members': readonlyParamsOptionsResultMembers,
    'require-component-suffix': requireComponentSuffix,
    'require-method-template': requireMethodTemplate,
    'require-super-call': requireSuperCall
  }
};
