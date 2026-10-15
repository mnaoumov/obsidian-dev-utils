import { genericInHouseEslintRules } from '@mnaoumov/typescript-dev-toolkit/linters/eslint-rules/in-house-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

import { obsidianDevUtilsPlugin } from './obsidian-dev-utils-plugin.ts';

describe('obsidianDevUtilsPlugin', () => {
  it('should carry every generic rule as the same rule object', () => {
    for (const [ruleName, rule] of Object.entries(genericInHouseEslintRules)) {
      expect(obsidianDevUtilsPlugin.rules?.[ruleName]).toBe(rule);
    }
  });

  it('should carry the Obsidian rules beside the generic ones', () => {
    const genericRuleNames = new Set(Object.keys(genericInHouseEslintRules));
    const obsidianRuleNames = Object.keys(obsidianDevUtilsPlugin.rules ?? {}).filter((ruleName) => !genericRuleNames.has(ruleName));
    expect(obsidianRuleNames.sort()).toEqual([
      'manifest-description',
      'manifest-id',
      'manifest-name',
      'manifest-schema',
      'no-over-cap-wait-in-eval-in-obsidian',
      'no-untrusted-input-events',
      'require-component-suffix'
    ]);
  });
});
