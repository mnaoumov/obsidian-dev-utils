/**
 * @file
 *
 * `no-restricted-syntax` rule entries for the shared ESLint config.
 *
 * Exported as a standalone constant so each selector can be unit-tested
 * independently of the larger declarative config.
 */

/**
 * A single `no-restricted-syntax` entry pairing an ESLint AST selector with a
 * human-readable message explaining why the pattern is banned.
 */
export interface NoRestrictedSyntaxRuleEntry {
  /**
   * Human-readable message shown when the selector matches.
   */
  message: string;

  /**
   * ESLint AST selector identifying the banned pattern.
   */
  selector: string;
}

/**
 * Restricted-syntax entries enforced by the shared ESLint config.
 */
export const noRestrictedSyntaxRuleEntries: readonly NoRestrictedSyntaxRuleEntry[] = [
  {
    message: 'Do not use definite assignment assertions (!). Initialize the field or make it optional.',
    selector: 'PropertyDefinition[definite=true]'
  },
  {
    message: 'Do not use definite assignment assertions (!) on abstract fields.',
    selector: 'TSAbstractPropertyDefinition[definite=true]'
  },
  {
    message: 'Do not use anonymous inline object types in function parameters. Define a named interface instead.',
    selector: ':function > Identifier TSTypeLiteral'
  },
  {
    message: 'Do not use anonymous inline object types in function return types. Define a named interface instead.',
    selector: ':function > TSTypeAnnotation TSTypeLiteral'
  },
  {
    message: 'Do not use anonymous inline object types in interface/method signatures. Define a named interface instead.',
    selector: 'TSMethodSignature TSTypeLiteral'
  },
  {
    message: 'Do not use anonymous inline object types as type arguments. Define a named interface instead.',
    selector: 'TSTypeParameterInstantiation TSTypeLiteral'
  },
  {
    message: 'Do not use anonymous inline object types in type annotations. Define a named interface instead.',
    selector: 'TSTypeAnnotation TSTypeLiteral'
  },
  {
    message: 'Do not use anonymous inline object types in type assertions. Define a named interface instead.',
    selector: 'TSAsExpression TSTypeLiteral'
  },
  {
    message: 'Do not use double type assertions (as X as Y).',
    selector: 'TSAsExpression > TSAsExpression'
  },
  {
    message:
      'Do not use `as never`. It silently satisfies type constraints by claiming "this value is of every type" — almost always masks a real type mismatch. Fix the underlying types instead.',
    selector: 'TSAsExpression > TSNeverKeyword'
  },
  {
    message: 'Do not use `<never>` type assertions. Same reasoning as `as never`.',
    selector: 'TSTypeAssertion > TSNeverKeyword'
  },
  {
    message: 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only.',
    selector: 'MethodDefinition[key.name=/^_/]:not([override=true])'
  },
  {
    message: 'Do not use _ prefix on methods or functions. The _ prefix is for unused parameters only.',
    selector: 'FunctionDeclaration[id.name=/^_/]'
  },
  {
    message: 'Do not rename imports with "Mock" in the alias. Mock classes are the canonical types — use the original name.',
    selector: 'ImportSpecifier[local.name=/Mock/]:not([imported.name=/Mock/])'
  },
  {
    message: 'Avoid dynamic import(). Use static imports instead. Only use dynamic imports for lazy/conditional loading.',
    selector: 'ImportExpression'
  },
  {
    message: 'Do not use `declare` on class properties. Initialize the property or use a regular type annotation.',
    selector: 'PropertyDefinition[declare=true]'
  }
];
