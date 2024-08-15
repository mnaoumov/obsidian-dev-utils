declare module "compare-versions" {
  export type CompareOperator = '>' | '>=' | '=' | '<' | '<=';

  // Assuming that the module also has a default export
  const compareVersions: {
    (v1: string, v2: string, operator?: CompareOperator): boolean;
    CompareOperator: CompareOperator;
  };

  export default compareVersions;
}
