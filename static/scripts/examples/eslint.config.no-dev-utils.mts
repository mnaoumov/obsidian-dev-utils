import type { Linter } from 'eslint';

const configs: Linter.Config[] = [
  {
    files: [
      '**/*.ts'
    ],
    rules: {
      'no-console': 'error'
    }
  }
];

// eslint-disable-next-line import-x/no-default-export
export default configs;
