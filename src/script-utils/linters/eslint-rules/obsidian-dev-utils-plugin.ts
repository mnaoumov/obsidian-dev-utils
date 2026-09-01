/**
 * @file
 *
 * ESLint plugin for Obsidian development utilities.
 */
import type { ESLint } from 'eslint';

import { manifestDescription } from './manifest-description.ts';
import { manifestId } from './manifest-id.ts';
import { manifestName } from './manifest-name.ts';
import { manifestSchema } from './manifest-schema.ts';
import { noAsyncCallbackToUnsafeReturn } from './no-async-callback-to-unsafe-return.ts';
import { noUntrustedInputEvents } from './no-untrusted-input-events.ts';
import { noUnusedParamsMembers } from './no-unused-params-members.ts';
import { noUsedUnderscoreVariables } from './no-used-underscore-variables.ts';
import { paramsOptionsNameMatch } from './params-options-name-match.ts';
import { preferNoopAsync } from './prefer-noop-async.ts';
import { readonlyParamsOptionsResultMembers } from './readonly-params-options-result-members.ts';
import { requireComponentSuffix } from './require-component-suffix.ts';
import { requireMethodTemplate } from './require-method-template.ts';
import { requireSuperCall } from './require-super-call.ts';

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
