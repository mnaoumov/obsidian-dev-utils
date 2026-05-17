/**
 * @file
 *
 * ESLint rule: readonly-params-options-members
 *
 * Reports an error when an interface or type alias whose name ends with
 * `Params` or `Options` has a property signature that is not `readonly`.
 * Parameter/options bags should be immutable — callers should never mutate
 * the object they received.
 */
import type { Rule } from 'eslint';

import { ensureNonNullable } from '../../../type-guards.ts';

export const MESSAGE_ID = 'readonlyParamsOptionsMembers';

interface PropertySignatureNode {
  readonly key: Rule.Node;
}

export const readonlyParamsOptionsMembers: Rule.RuleModule = {
  create(context) {
    return {
      'TSInterfaceDeclaration[id.name=/(?:Params|Options)$/] TSPropertySignature[readonly=false]'(node: Rule.Node): void {
        reportNonReadonly(context, node);
      },
      'TSTypeAliasDeclaration[id.name=/(?:Params|Options)$/] TSPropertySignature[readonly=false]'(node: Rule.Node): void {
        reportNonReadonly(context, node);
      }
    };

    function reportNonReadonly(ctx: Rule.RuleContext, node: Rule.Node): void {
      const propertyNode = node as Partial<PropertySignatureNode>;
      ctx.report({
        fix(fixer) {
          return fixer.insertTextBefore(ensureNonNullable(propertyNode.key), 'readonly ');
        },
        messageId: MESSAGE_ID,
        node
      });
    }
  },
  meta: {
    docs: {
      description: 'Require all properties in `*Params` and `*Options` interfaces to be `readonly`'
    },
    fixable: 'code',
    messages: {
      [MESSAGE_ID]: 'Property must be `readonly`. Params/Options interfaces should be immutable.'
    },
    schema: [],
    type: 'suggestion'
  }
};
