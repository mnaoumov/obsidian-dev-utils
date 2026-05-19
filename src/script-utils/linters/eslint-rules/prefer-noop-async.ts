/**
 * @file
 *
 * ESLint rule: prefer-noop-async
 *
 * Reports `await Promise.resolve()` and suggests replacing it with
 * `await noopAsync()` for consistency and readability.
 *
 * `noopAsync()` from the project's `function.ts` module is the conventional
 * way to express an intentional async no-op.
 */
import type { TSESTree } from '@typescript-eslint/utils';
import type { Rule } from 'eslint';

export const MESSAGE_ID = 'preferNoopAsync';

export const preferNoopAsync: Rule.RuleModule = {
  create(context) {
    return {
      'CallExpression'(node: Rule.Node): void {
        const callNode = node as TSESTree.CallExpression;

        if (!checkIsPromiseResolveWithNoArgs(callNode)) {
          return;
        }

        context.report({
          fix(fixer) {
            return fixer.replaceText(node, 'noopAsync()');
          },
          messageId: MESSAGE_ID,
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: 'Prefer `noopAsync()` over `Promise.resolve()`'
    },
    fixable: 'code',
    messages: {
      [MESSAGE_ID]: 'Use `noopAsync()` instead of `Promise.resolve()` for async no-ops.'
    },
    schema: [],
    type: 'suggestion'
  }
};

/**
 * Checks whether a call expression is `Promise.resolve()` with no arguments.
 *
 * @param node - The call expression node.
 * @returns `true` if the node is `Promise.resolve()` with no arguments.
 */
function checkIsPromiseResolveWithNoArgs(node: TSESTree.CallExpression): boolean {
  if (node.arguments.length > 0) {
    return false;
  }

  const callee = node.callee;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (callee.type !== 'MemberExpression') {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (callee.object.type !== 'Identifier' || callee.object.name !== 'Promise') {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (callee.property.type !== 'Identifier' || callee.property.name !== 'resolve') {
    return false;
  }

  return true;
}
