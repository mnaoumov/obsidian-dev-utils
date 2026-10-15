/**
 * @file
 *
 * The generic in-house ESLint rules, and the plugin that registers them.
 *
 * Every in-house rule is registered under ONE namespace, {@link IN_HOUSE_ESLINT_PLUGIN_NAME}, whichever package
 * defines it, so a disable comment naming `obsidian-dev-utils/<rule>` keeps working however the rules are split
 * between packages. ESLint refuses two different plugin objects under one namespace in a single configuration, so a
 * package adding rules of its own builds ONE plugin from {@link genericInHouseEslintRules} plus its own and hands
 * that to the generic configuration, rather than registering a second plugin beside {@link inHouseEslintPlugin}.
 */

import type { ESLint } from 'eslint';

import { noAsyncCallbackToUnsafeReturn } from './no-async-callback-to-unsafe-return.ts';
import { noUnresolvedJsdocLink } from './no-unresolved-jsdoc-link.ts';
import { noUnusedParamsMembers } from './no-unused-params-members.ts';
import { noUsedUnderscoreVariables } from './no-used-underscore-variables.ts';
import { paramsOptionsNameMatch } from './params-options-name-match.ts';
import { preferNoopAsync } from './prefer-noop-async.ts';
import { readonlyParamsOptionsResultMembers } from './readonly-params-options-result-members.ts';
import { requireMethodTemplate } from './require-method-template.ts';
import { requireSuperCall } from './require-super-call.ts';

/**
 * The namespace every in-house rule is registered under. It keeps the name of the library the rules started in,
 * because existing disable comments name it.
 */
export const IN_HOUSE_ESLINT_PLUGIN_NAME = 'obsidian-dev-utils';

/**
 * The generic in-house rules, keyed by their name inside {@link IN_HOUSE_ESLINT_PLUGIN_NAME}.
 */
export const genericInHouseEslintRules: NonNullable<ESLint.Plugin['rules']> = {
  'no-async-callback-to-unsafe-return': noAsyncCallbackToUnsafeReturn,
  'no-unresolved-jsdoc-link': noUnresolvedJsdocLink,
  'no-unused-params-members': noUnusedParamsMembers,
  'no-used-underscore-variables': noUsedUnderscoreVariables,
  'params-options-name-match': paramsOptionsNameMatch,
  'prefer-noop-async': preferNoopAsync,
  'readonly-params-options-result-members': readonlyParamsOptionsResultMembers,
  'require-method-template': requireMethodTemplate,
  'require-super-call': requireSuperCall
};

/**
 * The ESLint plugin registering the generic in-house rules alone, for a project that adds none of its own.
 */
export const inHouseEslintPlugin: ESLint.Plugin = {
  rules: genericInHouseEslintRules
};
