/**
 * @file
 *
 * ESLint rule: require-super-call
 *
 * Reports an error when an `override` method does not call `super.methodName()`
 * anywhere in its body. Overriding a method without calling `super` is almost
 * always a mistake that silently breaks parent-class behavior (lifecycle hooks,
 * initialization, event wiring, etc.).
 *
 * The super call can appear anywhere in the method body — as a standalone
 * statement, awaited, assigned to a variable, or nested in any expression.
 *
 * The rule automatically skips methods where the parent implementation is
 * `abstract`, since there is no concrete `super` to call.
 *
 * If the override intentionally replaces the parent implementation, disable the
 * rule on that line with an explanatory comment.
 */
import type {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/utils';
import type { Rule } from 'eslint';
import type {
  Declaration,
  TypeChecker
} from 'typescript';

import {
  canHaveModifiers,
  getModifiers,
  SyntaxKind
} from 'typescript';

import {
  assert,
  assertNonNullable
} from '../../../type-guards.ts';

export const MESSAGE_ID = 'requireSuperCall';

interface OverrideMethodInfo {
  hasSuperCall: boolean;
  methodName: string;
  node: TSESTree.MethodDefinition;
  reportNode: Rule.Node;
}

export const requireSuperCall: Rule.RuleModule = {
  create(context) {
    const services = context.sourceCode.parserServices as ParserServicesWithTypeInformation;
    const checker = services.program.getTypeChecker();
    const methodStack: OverrideMethodInfo[] = [];

    return {
      'CallExpression'(node: Rule.Node): void {
        const current = methodStack[methodStack.length - 1];
        if (!current) {
          return;
        }

        const callNode = node as TSESTree.CallExpression;
        if (checkIsSuperMethodCall(callNode, current.methodName)) {
          current.hasSuperCall = true;
        }
      },
      'MethodDefinition'(node: Rule.Node): void {
        const methodNode = node as TSESTree.MethodDefinition;

        if (!methodNode.override) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
        if (methodNode.key.type !== 'Identifier') {
          return;
        }

        methodStack.push({
          hasSuperCall: false,
          methodName: methodNode.key.name,
          node: methodNode,
          reportNode: node
        });
      },
      'MethodDefinition:exit'(): void {
        const info = methodStack[methodStack.length - 1];
        if (!info) {
          return;
        }

        methodStack.pop();

        if (info.hasSuperCall) {
          return;
        }

        if (checkIsParentMethodAbstract(services, checker, info.node, info.methodName)) {
          return;
        }

        context.report({
          data: { methodName: info.methodName },
          messageId: MESSAGE_ID,
          node: info.reportNode
        });
      }
    };
  },
  meta: {
    docs: {
      description: 'Require `override` methods to call `super.methodName()`'
    },
    messages: {
      [MESSAGE_ID]: 'Override method `{{ methodName }}` must call `super.{{ methodName }}()`.'
    },
    schema: [],
    type: 'problem'
  }
};

/**
 * Checks whether a declaration has the `abstract` modifier.
 *
 * @param decl - The TypeScript declaration to inspect.
 * @returns `true` if the declaration is abstract.
 */
function checkIsAbstract(decl: Declaration): boolean {
  assert(canHaveModifiers(decl), 'Expected method declaration to support modifiers');

  const modifiers = getModifiers(decl);
  return modifiers?.some((mod) => mod.kind === SyntaxKind.AbstractKeyword) ?? false;
}

/**
 * Checks whether the parent class's version of the method is `abstract`.
 *
 * @param services - The parser services with type information.
 * @param checker - The TypeScript type checker.
 * @param methodNode - The override method definition AST node.
 * @param methodName - The method name to look up in the parent class.
 * @returns `true` if the parent method is abstract.
 */
function checkIsParentMethodAbstract(
  services: ParserServicesWithTypeInformation,
  checker: TypeChecker,
  methodNode: TSESTree.MethodDefinition,
  methodName: string
): boolean {
  const classDecl = methodNode.parent.parent;
  const tsClassNode = services.esTreeNodeToTSNodeMap.get(classDecl);
  const classType = checker.getTypeAtLocation(tsClassNode);
  const baseTypes = classType.getBaseTypes();
  assertNonNullable(baseTypes, 'Expected class with override method to have base types');

  for (const baseType of baseTypes) {
    const prop = baseType.getProperty(methodName);
    assertNonNullable(prop, `Expected base type to have property '${methodName}'`);

    const declarations = prop.getDeclarations();
    assertNonNullable(declarations, `Expected property '${methodName}' to have declarations`);
    for (const decl of declarations) {
      if (checkIsAbstract(decl)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a call expression is `super.methodName(...)`.
 *
 * @param node - The call expression node.
 * @param methodName - The expected method name.
 * @returns `true` if the node is a matching super method call.
 */
function checkIsSuperMethodCall(node: TSESTree.CallExpression, methodName: string): boolean {
  const callee = node.callee;
  /* eslint-disable @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values. */
  return callee.type === 'MemberExpression'
    && callee.object.type === 'Super'
    && callee.property.type === 'Identifier'
    && callee.property.name === methodName;
  /* eslint-enable @typescript-eslint/no-unsafe-enum-comparison -- Re-enable after multi-line string comparison block. */
}
