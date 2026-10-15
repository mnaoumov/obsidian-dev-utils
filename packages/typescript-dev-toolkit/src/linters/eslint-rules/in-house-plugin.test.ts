import {
  describe,
  expect,
  it
} from 'vitest';

import {
  genericInHouseEslintRules,
  IN_HOUSE_ESLINT_PLUGIN_NAME,
  inHouseEslintPlugin
} from './in-house-plugin.ts';

describe('in-house plugin', () => {
  it('should keep the namespace existing disable comments name', () => {
    expect(IN_HOUSE_ESLINT_PLUGIN_NAME).toBe('obsidian-dev-utils');
  });

  it('should register every generic rule', () => {
    expect(Object.keys(genericInHouseEslintRules).sort()).toEqual([
      'no-async-callback-to-unsafe-return',
      'no-unresolved-jsdoc-link',
      'no-unused-params-members',
      'no-used-underscore-variables',
      'params-options-name-match',
      'prefer-noop-async',
      'readonly-params-options-result-members',
      'require-method-template',
      'require-super-call'
    ]);
    expect(inHouseEslintPlugin.rules).toBe(genericInHouseEslintRules);
  });
});
