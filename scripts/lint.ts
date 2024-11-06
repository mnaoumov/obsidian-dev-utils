// eslint-disable-next-line import-x/default
import eslintPluginTsdocRequired from '@guardian/eslint-plugin-tsdoc-required';
import eslintPluginTsdoc from 'eslint-plugin-tsdoc';
import eslintPluginVerifyTsdoc from 'eslint-plugin-verify-tsdoc';

import { wrapCliTask } from '../src/scripts/CliUtils.ts';
import { lint } from '../src/scripts/ESLint/ESLint.ts';
import { process } from '../src/scripts/NodeModules.ts';

await wrapCliTask(async () => {
  const fix = process.argv[2] === 'fix';
  return await lint(fix, [{
    plugins: {
      'eslint-plugin-tsdoc-required': eslintPluginTsdocRequired,
      'tsdoc': eslintPluginTsdoc,
      'verify-tsdoc': eslintPluginVerifyTsdoc
    },
    rules: {
      'eslint-plugin-tsdoc-required/tsdoc-required': 'error',
      'tsdoc/syntax': 'error',
      'verify-tsdoc/verify-tsdoc-params': 'error'
    }
  }]);
});
