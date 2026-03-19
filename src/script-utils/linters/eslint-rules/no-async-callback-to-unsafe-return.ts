/**
 * @packageDocumentation
 *
 * ESLint rule: no-async-callback-to-unsafe-return
 *
 * Reports an error when an async function is passed as a callback argument
 * to a function parameter whose return type is `any` or `unknown`. Because
 * these types silently accept `Promise<T>`, the caller won't await the
 * result, leading to unhandled promise rejections at runtime.
 *
 * Example:
 * ```typescript
 * // onClick(fn: (evt: MouseEvent) => any)
 * button.onClick(async () => {
 *   await someFn(); // Unhandled rejection if someFn throws
 * });
 * ```
 *
 * `@typescript-eslint/no-misused-promises` only catches `=> void` callbacks.
 * This rule closes the gap for `=> any` and `=> unknown` callbacks.
 */
import type {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/utils';
import type { Rule } from 'eslint';

import ts from 'typescript';

export const MESSAGE_ID = 'noAsyncCallbackToUnsafeReturn';

// eslint-disable-next-line no-bitwise -- Bitwise flag mask is idiomatic for TypeScript compiler API.
const UNSAFE_RETURN_FLAGS = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

/**
 * Checks whether the given TypeScript type is a function type whose return
 * type is `any` or `unknown`.
 *
 * @param checker - TypeScript type checker.
 * @param type - The type to inspect.
 * @returns `true` if the type has at least one call signature returning `any` or `unknown`.
 */
function hasUnsafeReturnCallSignature(checker: ts.TypeChecker, type: ts.Type): boolean {
  for (const sig of type.getCallSignatures()) {
    const returnType = checker.getReturnTypeOfSignature(sig);
    // eslint-disable-next-line no-bitwise -- Bitwise flag check is idiomatic for TypeScript compiler API.
    if (returnType.flags & UNSAFE_RETURN_FLAGS) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a node is an async function expression (arrow or regular).
 *
 * @param node - AST node to check.
 * @returns `true` if the node is an async arrow or function expression.
 */
function isAsyncFunctionNode(node: TSESTree.Node): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') && node.async;
}

export const noAsyncCallbackToUnsafeReturn: Rule.RuleModule = {
  create(context) {
    const services = context.sourceCode.parserServices as ParserServicesWithTypeInformation;
    const checker = services.program.getTypeChecker();

    return {
      CallExpression(node: Rule.Node): void {
        const callNode = node as TSESTree.CallExpression;

        for (let i = 0; i < callNode.arguments.length; i++) {
          const arg = callNode.arguments[i];
          if (!arg || !isAsyncFunctionNode(arg)) {
            continue;
          }

          const tsCalleeNode = services.esTreeNodeToTSNodeMap.get(callNode.callee);
          const calleeType = checker.getTypeAtLocation(tsCalleeNode);

          for (const sig of calleeType.getCallSignatures()) {
            const param = sig.getParameters()[i];
            if (!param) {
              continue;
            }

            const paramType = checker.getTypeOfSymbol(param);

            if (hasUnsafeReturnCallSignature(checker, paramType)) {
              context.report({
                messageId: MESSAGE_ID,
                node: arg as Rule.Node
              });
              break;
            }
          }
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Disallow passing async functions as callbacks to parameters with `any` or `unknown` return type'
    },
    messages: {
      [MESSAGE_ID]:
        'Async function passed as callback to a parameter with `any`/`unknown` return type. This may cause unhandled promise rejections. Wrap the call: `(...args) => { yourAsyncFn(...args); }`.'
    },
    schema: [],
    type: 'problem'
  }
};
