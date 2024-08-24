/**
 * @packageDocumentation compare-versions
 * Fixed typings for the `compare-versions` package.
 */

declare module "compare-versions" {
  /**
   * Defines the set of comparison operators that can be used to compare version strings.
   *
   * - `>`: Checks if the first version is greater than the second.
   * - `>=`: Checks if the first version is greater than or equal to the second.
   * - `=`: Checks if the first version is equal to the second.
   * - `<`: Checks if the first version is less than the second.
   * - `<=`: Checks if the first version is less than or equal to the second.
   */
  export type CompareOperator = ">" | ">=" | "=" | "<" | "<=";

  /**
   * Compares two version strings using semantic versioning rules.
   *
   * @param v1 - The first version string to compare.
   * @param v2 - The second version string to compare.
   * @param operator - The comparison operator to use. If not provided, defaults to `"="`.
   * @returns `true` if the comparison between `v1` and `v2` is true based on the provided operator, otherwise `false`.
   */
  const compareVersions: {
    (v1: string, v2: string, operator?: CompareOperator): boolean;

    /**
     * The set of valid comparison operators that can be used with the `compareVersions` function.
     */
    CompareOperator: CompareOperator;
  };

  export default compareVersions;
}
