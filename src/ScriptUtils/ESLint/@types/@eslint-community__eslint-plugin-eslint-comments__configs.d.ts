/**
 * @packageDocumentation \@eslint-community/eslint-plugin-eslint-comments/configs
 *
 * @see {@link https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments} for more information.
 */

declare module '@eslint-community/eslint-plugin-eslint-comments/configs' {
  import type { Linter } from 'eslint';

  const configs: {
    recommended: Linter.Config;
  };
  // eslint-disable-next-line import-x/no-default-export
  export default configs;
}
