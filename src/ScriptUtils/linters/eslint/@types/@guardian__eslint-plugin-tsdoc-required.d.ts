/**
 * @packageDocumentation \@guardian/eslint-plugin-tsdoc-required
 *
 * @see {@link https://www.npmjs.com/package/@guardian/eslint-plugin-tsdoc-required} for more information.
 */

declare module '@guardian/eslint-plugin-tsdoc-required' {
  import type { ESLint } from 'eslint';

  const plugin: ESLint.Plugin;

  // eslint-disable-next-line import-x/no-default-export -- That is the way library exports.
  export default plugin;
}
