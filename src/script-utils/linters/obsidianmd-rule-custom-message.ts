/**
 * @file
 *
 * Keeps `obsidianmd/rule-custom-message` from re-running a builtin rule this library's own config already sets.
 *
 * `eslint-plugin-obsidianmd`'s recommended config turns `no-console` and `no-new-func` off and re-runs each through
 * `obsidianmd/rule-custom-message`, which fetches the builtin rule and reports its findings under its OWN rule id. So
 * the severity a consumer writes on `no-console` is never consulted: `'no-console': 'off'` is inert, and the error
 * that remains names a rule the consumer never configured. This library sets both builtins itself, stricter, so in
 * every consumer the wrapper added nothing but a second report of the same line.
 */

import type { Linter } from 'eslint';

/**
 * The rule id of the wrapper that re-reports builtin rules under its own name.
 */
export const RULE_CUSTOM_MESSAGE_RULE_NAME = 'obsidianmd/rule-custom-message';

/**
 * Parameters for {@link stripOwnedRuleCustomMessageEntries}.
 */
export interface StripOwnedRuleCustomMessageEntriesParams {
  /**
   * The config whose `obsidianmd/rule-custom-message` entry is narrowed.
   */
  readonly config: Linter.Config;

  /**
   * The builtin rule names this library's own config sets, which the wrapper must no longer re-run.
   */
  readonly ownedRuleNames: ReadonlySet<string>;
}

/**
 * Removes from a config's `obsidianmd/rule-custom-message` options every wrapped rule named in `ownedRuleNames`.
 *
 * An entry for a rule NOT in the set keeps running through the wrapper, so an entry upstream adds later is not
 * silently dropped. When nothing is left the wrapper is turned `off` rather than run with an empty map.
 *
 * @param params - The parameters.
 * @returns The config, unchanged when it carries no narrowable wrapper entry, otherwise a narrowed copy.
 */
export function stripOwnedRuleCustomMessageEntries(params: StripOwnedRuleCustomMessageEntriesParams): Linter.Config {
  const { config, ownedRuleNames } = params;
  const ruleEntry = config.rules?.[RULE_CUSTOM_MESSAGE_RULE_NAME];
  if (!Array.isArray(ruleEntry)) {
    return config;
  }

  const [severity, wrappedRules, ...restOptions] = ruleEntry as unknown[];
  if (typeof wrappedRules !== 'object' || wrappedRules === null) {
    return config;
  }

  const keptEntries = Object.entries(wrappedRules).filter(([ruleName]) => !ownedRuleNames.has(ruleName));
  const narrowedRuleEntry: Linter.RuleEntry = keptEntries.length === 0
    ? 'off'
    : [severity as Linter.RuleSeverity, Object.fromEntries(keptEntries), ...restOptions];

  return {
    ...config,
    rules: {
      ...config.rules,
      [RULE_CUSTOM_MESSAGE_RULE_NAME]: narrowedRuleEntry
    }
  };
}
