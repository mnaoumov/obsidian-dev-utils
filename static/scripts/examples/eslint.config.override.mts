import { configs as devUtilsConfigs } from 'obsidian-dev-utils/ScriptUtils/ESLint/eslint.config';

const configs = [
  ...devUtilsConfigs,
  {
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
];

// eslint-disable-next-line import-x/no-default-export
export default configs;
