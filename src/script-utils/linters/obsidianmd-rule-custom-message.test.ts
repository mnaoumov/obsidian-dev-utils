/**
 * @file
 *
 * Unit tests for `obsidianmd-rule-custom-message.ts`, including an end-to-end check against the wrapper entry that
 * `eslint-plugin-obsidianmd`'s recommended config actually ships.
 */

import type { Linter as LinterType } from 'eslint';

import { Linter } from 'eslint';
// eslint-disable-next-line import-x/no-rename-default -- The default export name `plugin` is too confusing.
import obsidianmd from 'eslint-plugin-obsidianmd';
import {
  describe,
  expect,
  it
} from 'vitest';

import { assertNonNullable } from '../../type-guards.ts';
import {
  RULE_CUSTOM_MESSAGE_RULE_NAME,
  stripOwnedRuleCustomMessageEntries
} from './obsidianmd-rule-custom-message.ts';

function getUpstreamRuleEntry(): LinterType.RuleEntry {
  const ruleEntry = obsidianmd.configs.recommended
    .map((config) => config.rules?.[RULE_CUSTOM_MESSAGE_RULE_NAME])
    .find((entry) => entry !== undefined);
  assertNonNullable(ruleEntry);
  return ruleEntry;
}

function lintConsoleLog(ruleCustomMessageEntry: LinterType.RuleEntry): LinterType.LintMessage[] {
  return new Linter().verify('console.log(1);', {
    plugins: { obsidianmd },
    rules: {
      'no-console': 'off',
      [RULE_CUSTOM_MESSAGE_RULE_NAME]: ruleCustomMessageEntry
    }
  });
}

describe('stripOwnedRuleCustomMessageEntries', () => {
  it('returns the config unchanged when it has no rules', () => {
    const config: LinterType.Config = {};
    expect(stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames: new Set(['no-console']) })).toBe(config);
  });

  it('returns the config unchanged when the wrapper entry is a bare severity', () => {
    const config: LinterType.Config = { rules: { [RULE_CUSTOM_MESSAGE_RULE_NAME]: 'error' } };
    expect(stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames: new Set(['no-console']) })).toBe(config);
  });

  it('returns the config unchanged when the wrapper entry carries no options object', () => {
    const config: LinterType.Config = { rules: { [RULE_CUSTOM_MESSAGE_RULE_NAME]: ['error'] } };
    expect(stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames: new Set(['no-console']) })).toBe(config);
  });

  it('keeps entries for rules not owned, and the rest of the config', () => {
    const config: LinterType.Config = {
      files: ['a.ts'],
      rules: {
        other: 'warn',
        [RULE_CUSTOM_MESSAGE_RULE_NAME]: ['error', { 'no-console': { messages: {} }, 'no-new-func': { messages: {} } }]
      }
    };
    expect(stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames: new Set(['no-console']) })).toEqual({
      files: ['a.ts'],
      rules: {
        other: 'warn',
        [RULE_CUSTOM_MESSAGE_RULE_NAME]: ['error', { 'no-new-func': { messages: {} } }]
      }
    });
  });

  it('turns the wrapper off when every entry is owned', () => {
    const config: LinterType.Config = {
      rules: { [RULE_CUSTOM_MESSAGE_RULE_NAME]: ['error', { 'no-console': { messages: {} } }] }
    };
    expect(stripOwnedRuleCustomMessageEntries({ config, ownedRuleNames: new Set(['no-console']) }).rules).toEqual({
      [RULE_CUSTOM_MESSAGE_RULE_NAME]: 'off'
    });
  });

  it('pins the premise: upstream\'s wrapper reports a console line although no-console is off', () => {
    expect(lintConsoleLog(getUpstreamRuleEntry()).map((message) => message.ruleId)).toEqual([RULE_CUSTOM_MESSAGE_RULE_NAME]);
  });

  it('makes a consumer\'s no-console off authoritative over upstream\'s wrapper', () => {
    const config = stripOwnedRuleCustomMessageEntries({
      config: { rules: { [RULE_CUSTOM_MESSAGE_RULE_NAME]: getUpstreamRuleEntry() } },
      ownedRuleNames: new Set(['no-console', 'no-new-func'])
    });
    const ruleEntry = config.rules?.[RULE_CUSTOM_MESSAGE_RULE_NAME];
    assertNonNullable(ruleEntry);
    expect(lintConsoleLog(ruleEntry)).toEqual([]);
  });
});
