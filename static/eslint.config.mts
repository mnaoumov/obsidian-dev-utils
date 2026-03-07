import type { Linter } from 'eslint';
import { obsidianDevUtilsConfigs } from 'obsidian-dev-utils/script-utils/eslint/eslint.config';

const configs: Linter.Config[] = [
  ...obsidianDevUtilsConfigs
];

// eslint-disable-next-line import-x/no-default-export -- ESLint infrastructure requires a default export.
export default configs;
