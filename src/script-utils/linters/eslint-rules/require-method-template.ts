/**
 * @file
 *
 * ESLint rule: require-method-template
 *
 * Requires that generic methods (methods with type parameters) have
 * corresponding `@typeParam` (or `@template`) JSDoc tags for each type parameter.
 *
 * This fills a gap in `eslint-plugin-jsdoc`'s `require-template` rule, which
 * only checks top-level declarations (functions, classes, interfaces, type aliases)
 * but not methods within classes.
 *
 * @see {@link https://github.com/gajus/eslint-plugin-jsdoc/issues/1386}
 */
import type { TSESTree } from '@typescript-eslint/utils';
import type { Rule } from 'eslint';
import type { Comment } from 'estree';

import { ensureNonNullable } from '../../../type-guards.ts';

interface JsdocSettings {
  tagNamePreference?: Record<string, string>;
}

const TAG_NAME = 'typeParam';

export const MESSAGE_ID_MISSING_TEMPLATE = 'missingTemplate';
export const MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION = 'missingTemplateDescription';

export const requireMethodTemplate: Rule.RuleModule = {
  create(context) {
    const settings = context.settings['jsdoc'] as JsdocSettings | undefined;
    const preferredTagName = settings?.tagNamePreference?.['template'] ?? TAG_NAME;

    return {
      'MethodDefinition'(node: Rule.Node): void {
        const methodNode = node as TSESTree.MethodDefinition;
        const functionExpr = methodNode.value;

        const typeParams = functionExpr.typeParameters?.params;
        if (!typeParams || typeParams.length === 0) {
          return;
        }

        const sourceCode = context.sourceCode;
        const comments = sourceCode.getCommentsBefore(node);
        const jsdocComment = findJsdocComment(comments);

        if (!jsdocComment) {
          return;
        }

        const parsedTags = parseTypeParamTags(jsdocComment.value, preferredTagName);

        for (const typeParam of typeParams) {
          const paramName = typeParam.name.name;
          const matchingTag = parsedTags.find((tag) => tag.name === paramName);

          if (!matchingTag) {
            context.report({
              data: {
                paramName,
                tagName: preferredTagName
              },
              messageId: MESSAGE_ID_MISSING_TEMPLATE,
              node
            });
          } else if (!matchingTag.hasDescription) {
            context.report({
              data: {
                paramName,
                tagName: preferredTagName
              },
              messageId: MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION,
              node
            });
          }
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Require `@typeParam` tags with descriptions for generic method type parameters'
    },
    messages: {
      [MESSAGE_ID_MISSING_TEMPLATE]: 'Missing @{{ tagName }} {{ paramName }}',
      [MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION]: '@{{ tagName }} {{ paramName }} is missing a description'
    },
    schema: [],
    type: 'suggestion'
  }
};

interface ParsedTag {
  hasDescription: boolean;
  name: string;
}

/**
 * Finds the JSDoc block comment from a list of comments.
 *
 * @param comments - The comments before the node.
 * @returns The JSDoc block comment, or `undefined` if none found.
 */
function findJsdocComment(comments: readonly Comment[]): Comment | undefined {
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (comment?.type === 'Block' && comment.value.startsWith('*')) {
      return comment;
    }
  }

  return undefined;
}

/**
 * Parses `@typeParam` / `@template` tags from a JSDoc comment body.
 *
 * @param commentBody - The raw comment body (without the leading and trailing comment delimiters).
 * @param tagName - The preferred tag name (`typeParam` or `template`).
 * @returns An array of parsed tag entries.
 */
function parseTypeParamTags(commentBody: string, tagName: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const tagPattern = new RegExp(`@(?:${tagName}|template|typeParam)\\s+(?<typeName>\\w+)(?<rest>.*)`, 'g');

  let match;
  while ((match = tagPattern.exec(commentBody)) !== null) {
    const groups = ensureNonNullable(match.groups);
    const name = ensureNonNullable(groups['typeName']);
    const rest = ensureNonNullable(groups['rest']).trim();
    const hasDescription = rest.length > 0 && rest !== '-';
    tags.push({ hasDescription, name });
  }

  return tags;
}
