import { lint } from '../src/scripts/ESLint/ESLint.ts';
import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import process from 'node:process';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import eslintPluginVerifyTsdoc from 'eslint-plugin-verify-tsdoc';
import eslintPluginTsdocRequired from '@guardian/eslint-plugin-tsdoc-required';

await wrapCliTask(async () => {
  const fix = process.argv[2] === 'fix';
  return await lint(fix, [{
    plugins: {
      'tsdoc': eslintPluginTsdoc,
      'verify-tsdoc': eslintPluginVerifyTsdoc,
      'eslint-plugin-tsdoc-required': eslintPluginTsdocRequired
    },
    rules: {
      'tsdoc/syntax': 'error',
      'verify-tsdoc/verify-tsdoc-params': 'error',
      'eslint-plugin-tsdoc-required/tsdoc-required': 'error'
    }
  }]);
});
