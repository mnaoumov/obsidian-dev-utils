/**
 * @file
 *
 * ESLint rule: require-component-suffix
 *
 * Reports an error when a class that extends `Component` (from Obsidian,
 * directly or transitively) does not have a name ending with `Component`
 * (or `ComponentBase` for abstract base classes).
 *
 * Classes whose inheritance chain includes any of the Obsidian framework
 * classes that extend `Component` (e.g. `Plugin`, `View`,
 * `MarkdownRenderChild`, `Menu`, `HoverPopover`, `QueryController`)
 * are excluded because they follow Obsidian's own naming conventions.
 *
 * The rule uses the TypeScript type checker to walk the full inheritance
 * chain, so it works regardless of how many intermediate classes sit
 * between the user's class and `Component`.
 */
import type {
  ParserServicesWithTypeInformation,
  TSESTree
} from '@typescript-eslint/utils';
import type { Rule } from 'eslint';
import type { Type } from 'typescript';

export const MESSAGE_ID_MISSING_SUFFIX = 'requireComponentSuffix';
export const MESSAGE_ID_ABSTRACT_NEEDS_BASE = 'abstractNeedsComponentBase';
export const MESSAGE_ID_BASE_NOT_ABSTRACT = 'componentBaseNotAbstract';

/** Ancestor class names that opt a subtree out of the suffix requirement. */
const EXCLUDED_ANCESTORS = new Set(['HoverPopover', 'MarkdownRenderChild', 'Menu', 'Plugin', 'QueryController', 'View']);

/** The ancestor class name that triggers the suffix requirement. */
const REQUIRED_ANCESTOR = 'Component';

interface TypeWithBaseTypes {
  getBaseTypes?(): Type[] | undefined;
}

export const requireComponentSuffix: Rule.RuleModule = {
  create(context) {
    const services = context.sourceCode.parserServices as ParserServicesWithTypeInformation;
    const checker = services.program.getTypeChecker();

    return {
      'ClassDeclaration[id]'(node: Rule.Node): void {
        checkClass(context, services, checker, node);
      },
      'ClassExpression[id]'(node: Rule.Node): void {
        checkClass(context, services, checker, node);
      }
    };
  },
  meta: {
    docs: {
      description: 'Require classes extending `Component` to have names ending with `Component`'
    },
    messages: {
      [MESSAGE_ID_ABSTRACT_NEEDS_BASE]: 'Abstract class `{{ className }}` extends `Component` but its name does not end with `ComponentBase`.',
      [MESSAGE_ID_BASE_NOT_ABSTRACT]:
        'Class `{{ className }}` ends with `ComponentBase` but is not abstract. Only abstract classes may use the `ComponentBase` suffix.',
      [MESSAGE_ID_MISSING_SUFFIX]: 'Class `{{ className }}` extends `Component` but its name does not end with `Component`.'
    },
    schema: [],
    type: 'problem'
  }
};

/**
 * Checks a single class declaration or expression.
 *
 * @param context - The ESLint rule context.
 * @param services - The parser services with type information.
 * @param checker - The TypeScript type checker.
 * @param node - The class AST node.
 */
function checkClass(
  context: Rule.RuleContext,
  services: ParserServicesWithTypeInformation,
  checker: ReturnType<ParserServicesWithTypeInformation['program']['getTypeChecker']>,
  node: Rule.Node
): void {
  const classNode = node as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
  const classId = classNode.id;

  /* v8 ignore start -- ESLint selector `[id]` guarantees classId is present. */
  if (!classId) {
    return;
  }
  /* v8 ignore stop */

  const className = classId.name;
  const { abstract: isAbstract } = classNode;
  const endsWithComponentBase = className.endsWith('ComponentBase');
  const endsWithComponent = !endsWithComponentBase && className.endsWith('Component');

  // Correct: non-abstract ending with Component
  if (endsWithComponent && !isAbstract) {
    return;
  }

  // Correct: abstract ending with ComponentBase
  if (endsWithComponentBase && isAbstract) {
    return;
  }

  const tsNode = services.esTreeNodeToTSNodeMap.get(classNode);
  const classType = checker.getTypeAtLocation(tsNode);
  const ancestors = collectAncestorNames(classType);

  if (!ancestors.has(REQUIRED_ANCESTOR)) {
    return;
  }

  for (const excluded of EXCLUDED_ANCESTORS) {
    if (ancestors.has(excluded)) {
      return;
    }
  }

  if (endsWithComponentBase && !isAbstract) {
    context.report({
      data: { className },
      messageId: MESSAGE_ID_BASE_NOT_ABSTRACT,
      node
    });
  } else if (isAbstract) {
    context.report({
      data: { className },
      messageId: MESSAGE_ID_ABSTRACT_NEEDS_BASE,
      node
    });
  } else {
    context.report({
      data: { className },
      messageId: MESSAGE_ID_MISSING_SUFFIX,
      node
    });
  }
}

/**
 * Collects the names of all ancestor types in the inheritance chain.
 *
 * @param type - The TypeScript type to start from.
 * @returns A set of ancestor class names.
 */
function collectAncestorNames(type: Type): Set<string> {
  const names = new Set<string>();
  const visited = new Set<Type>();

  walkAncestors(type, names, visited);

  return names;

  /**
   * Recursively walks the base types of a type, collecting their names.
   *
   * @param currentType - The current type to inspect.
   * @param collectedNames - The set to add discovered ancestor names to.
   * @param visitedTypes - Types already visited, to prevent infinite loops.
   */
  function walkAncestors(currentType: Type, collectedNames: Set<string>, visitedTypes: Set<Type>): void {
    if (visitedTypes.has(currentType)) {
      return;
    }

    visitedTypes.add(currentType);

    const baseTypes = (currentType as TypeWithBaseTypes).getBaseTypes?.();

    if (!baseTypes) {
      return;
    }

    for (const baseType of baseTypes) {
      const symbol = baseType.getSymbol();

      if (symbol) {
        collectedNames.add(symbol.getName());
      }

      walkAncestors(baseType, collectedNames, visitedTypes);
    }
  }
}
