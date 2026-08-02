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

import { getMandatoryNamedGroup } from '../../../reg-exp.ts';

interface JsdocSettings {
  tagNamePreference?: Record<string, string>;
}

const TAG_NAME = 'typeParam';

/** Message ID reported when a method type parameter has no matching `@typeParam` tag. */
export const MESSAGE_ID_MISSING_TEMPLATE = 'missingTemplate';

/** Message ID reported when a method's `@typeParam` tag is missing a description. */
export const MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION = 'missingTemplateDescription';

export const requireMethodTemplate: Rule.RuleModule = {
  create(context) {
    const settings = context.settings['jsdoc'] as JsdocSettings | undefined;
    const preferredTagName = settings?.tagNamePreference?.['template'] ?? TAG_NAME;

    return {
      'MethodDefinition'(node: Rule.Node): void {
        const methodNode = node as TSESTree.MethodDefinition;
        const functionExpression = methodNode.value;

        const typeParams = functionExpression.typeParameters?.params;
        if (!typeParams || typeParams.length === 0) {
          return;
        }

        const sourceCode = context.sourceCode;
        const comments = sourceCode.getCommentsBefore(node);
        const jsdocComment = findJsdocComment(comments);

        if (!jsdocComment) {
          return;
        }

        const parsedTags = parseTypeParameterTags({
          commentBody: jsdocComment.value,
          tagName: preferredTagName
        });

        for (const typeParameter of typeParams) {
          const parameterName = typeParameter.name.name;
          const matchingTag = parsedTags.find((tag) => tag.name === parameterName);

          if (!matchingTag) {
            context.report({
              data: {
                paramName: parameterName,
                tagName: preferredTagName
              },
              messageId: MESSAGE_ID_MISSING_TEMPLATE,
              node
            });
          } else if (!matchingTag.hasDescription) {
            context.report({
              data: {
                paramName: parameterName,
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
 * Parameters for {@link parseTypeParamTags}.
 */
interface ParseTypeParameterTagsParams {
  /**
   * The raw comment body (without the leading and trailing comment delimiters).
   */
  readonly commentBody: string;

  /**
   * The preferred tag name (`typeParam` or `template`).
   */
  readonly tagName: string;
}

/**
 * Finds the JSDoc block comment from a list of comments.
 *
 * @param comments - The comments before the node.
 * @returns The JSDoc block comment, or `undefined` if none found.
 */
function findJsdocComment(comments: readonly Comment[]): Comment | undefined {
  for (let index = comments.length - 1; index >= 0; index--) {
    const comment = comments[index];
    if (comment?.type === 'Block' && comment.value.startsWith('*')) {
      return comment;
    }
  }

  return undefined;
}

/**
 * Parses `@typeParam` / `@template` tags from a JSDoc comment body.
 *
 * @param params - The parameters for the parse.
 * @returns An array of parsed tag entries.
 */
function parseTypeParameterTags(params: ParseTypeParameterTagsParams): ParsedTag[] {
  const { commentBody, tagName } = params;
  const tags: ParsedTag[] = [];
  /*
   * The `$` character is a legal identifier character that `\w` excludes, so a tag like `@typeParam $Object`
   * would fail to match at all and the type parameter would be reported as undocumented despite having a tag.
   */
  const tagPattern = new RegExp(String.raw`@(?:${tagName}|template|typeParam)\s+(?<typeName>[\w$]+)(?<rest>.*)`, 'g');

  let match;
  while ((match = tagPattern.exec(commentBody)) !== null) {
    const name = getMandatoryNamedGroup(match, 'typeName');
    const rest = getMandatoryNamedGroup(match, 'rest').trim();
    const hasDescription = rest.length > 0 && rest !== '-';
    tags.push({ hasDescription, name });
  }

  return tags;
}
