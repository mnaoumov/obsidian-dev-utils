/**
 * @file
 *
 * ESLint rule: no-over-cap-wait-in-eval-in-obsidian
 *
 * Reports an `evalInObsidian` / `pollInObsidian` closure that declares more waiting
 * than the transport can ever honour.
 *
 * A single closure is evaluated through one transport call, and that call is capped at
 * roughly 30 seconds — Appium surfaces the cap as a bare `WebDriverError: script timeout`
 * naming only `AppiumTransport.evaluate`, CDP as a command timeout. Neither names the wait
 * that actually blew the budget, so the failure reads as a broken device rather than as a
 * closure asking for more time than exists. That misdiagnosis cost `T796` two days.
 *
 * A closure declaring a 30 000 ms `waitUntil`, or two 20 000 ms ones, therefore cannot
 * succeed on any machine slow enough to need the time it asks for. The fix is to move the
 * waiting to Node: `pollInObsidian` runs a SHORT DOM-reading `poll` closure repeatedly,
 * evaluates `until` in Node, and carries the long budget in `timeoutInMilliseconds`, so no
 * single transport call is ever long.
 *
 * WHAT COUNTS toward a closure's budget, summed lexically: every `waitUntil` inside it —
 * taking the helper's documented 5 000 ms default when `timeoutInMilliseconds` is omitted,
 * which is what makes several small sibling waits add up honestly — plus every `sleep(n)`
 * settle. Waits inside a helper declared within the closure count too; the enclosing
 * closure is found by walking outwards, so a nested function attributes to the closure it
 * runs inside.
 *
 * WHAT DOES NOT. A budget that cannot be resolved to a number contributes nothing and is
 * never reported (owner, 2026-09-09). Scope analysis resolves the shapes that actually
 * occur — a literal, a `const` in any enclosing scope, and a destructured callback
 * parameter followed back through the call's own `input` object — and resolving through
 * scope rather than by regex is the whole reason this is a rule and not a script. But a
 * value arriving from a caller (`options.timeout ?? DEFAULT`, threaded through a
 * parameter) would need analysis across call boundaries, and reporting every such site would
 * make each legitimately parameterized helper red across thirty repos. A LOOP is out of scope
 * for the same reason: a `sleep` in a `while` has no statically declared ceiling, so the
 * sum below is per-iteration and says nothing about the whole.
 *
 * Not every over-cap closure can become a `poll` / `until` pair, so the rule is meant to be
 * disabled — with a reason — at the sites that have one. `require-description` makes that
 * reason mandatory, which is the point: it turns an invisible assumption into a written one.
 */
import type { TSESTree } from '@typescript-eslint/utils';
import type {
  Rule,
  Scope
} from 'eslint';

/**
 * Message ID reported when an in-Obsidian closure declares more waiting than the transport's cap allows.
 */
export const MESSAGE_ID = 'noOverCapWaitInEvalInObsidian';

/**
 * The cap assumed when the rule is configured without one, matching the transport's own script timeout.
 */
const DEFAULT_CAP_IN_MILLISECONDS = 30_000;

/**
 * The budget a `waitUntil` takes when it omits `timeoutInMilliseconds`, per `WaitUntilParams`.
 */
const WAIT_UNTIL_DEFAULT_TIMEOUT_IN_MILLISECONDS = 5000;

const INPUT_PROPERTY_NAME = 'input';
const SLEEP_CALLEE_NAME = 'sleep';
const TIMEOUT_PROPERTY_NAME = 'timeoutInMilliseconds';
const WAIT_UNTIL_CALLEE_NAME = 'waitUntil';

/**
 * Which properties of each helper's parameter object hold a closure that runs INSIDE Obsidian, and is
 * therefore subject to the cap. `pollInObsidian`'s `until` is deliberately absent: it is evaluated in
 * Node, which is the entire point of converting to it.
 */
const CLOSURE_NAMES_BY_CALLEE_NAME = new Map<string, readonly string[]>([
  ['evalInObsidian', ['callback']],
  ['pollInObsidian', ['poll', 'start']]
]);

/**
 * The rule's single option object.
 */
interface CapOptions {
  /**
   * The budget at or over which a closure is reported, in milliseconds.
   */
  readonly capInMilliseconds?: number;
}

/**
 * The waiting summed so far for one closure.
 */
interface ClosureBudget {
  /**
   * The node to report on.
   */
  readonly reportNode: TSESTree.Node;

  /**
   * The sum of every resolvable wait declared inside the closure.
   */
  readonly totalInMilliseconds: number;
}

/**
 * A function written as an object property, which is the only form either helper's closures take.
 */
type ClosureFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

/**
 * An in-Obsidian closure, together with the call it belongs to (needed to resolve a budget threaded
 * through that call's `input`) and the node to report on.
 */
interface EvalClosure {
  /**
   * The closure's function node, which identifies the closure across sibling waits and carries the
   * parameter pattern a budget threaded through `input` is destructured by.
   */
  readonly closureNode: ClosureFunction;

  /**
   * The helper's parameter object, carried so a budget threaded through `input` is read from the object
   * the closure was already found in rather than re-derived from the call.
   */
  readonly paramsNode: TSESTree.ObjectExpression;

  /**
   * The property the closure is written as, reported on so the message points at `callback` / `poll`
   * rather than at whichever wait happened to come first.
   */
  readonly reportNode: TSESTree.Node;
}

/**
 * ESLint rule disallowing an in-Obsidian closure whose declared waiting exceeds the transport's script-timeout cap.
 */
export const noOverCapWaitInEvalInObsidian: Rule.RuleModule = {
  create(context) {
    const options = context.options[0] as CapOptions | undefined;
    const capInMilliseconds = options?.capInMilliseconds ?? DEFAULT_CAP_IN_MILLISECONDS;
    const budgetByClosureNode = new Map<TSESTree.Node, ClosureBudget>();

    return {
      'CallExpression'(node: Rule.Node): void {
        const callNode = node as TSESTree.CallExpression;

        const budgetExpression = readWaitBudgetExpression(callNode);
        if (budgetExpression === undefined) {
          return;
        }

        const closure = findEnclosingEvalClosure(callNode);
        if (!closure) {
          return;
        }

        const waitInMilliseconds = budgetExpression === null
          ? WAIT_UNTIL_DEFAULT_TIMEOUT_IN_MILLISECONDS
          : resolveMilliseconds(budgetExpression, closure, context);
        if (waitInMilliseconds === null) {
          return;
        }

        const runningTotalInMilliseconds = budgetByClosureNode.get(closure.closureNode)?.totalInMilliseconds ?? 0;
        budgetByClosureNode.set(closure.closureNode, {
          reportNode: closure.reportNode,
          totalInMilliseconds: runningTotalInMilliseconds + waitInMilliseconds
        });
      },
      'Program:exit'(): void {
        for (const budget of budgetByClosureNode.values()) {
          if (budget.totalInMilliseconds < capInMilliseconds) {
            continue;
          }

          context.report({
            data: {
              capInMilliseconds: String(capInMilliseconds),
              totalInMilliseconds: String(budget.totalInMilliseconds)
            },
            messageId: MESSAGE_ID,
            node: budget.reportNode
          });
        }
      }
    };
  },
  meta: {
    docs: {
      description: 'Disallow an in-Obsidian closure declaring more waiting than the transport\'s script-timeout cap allows'
    },
    messages: {
      [MESSAGE_ID]: 'This closure declares {{ totalInMilliseconds }} ms of waiting, at or over the transport\'s {{ capInMilliseconds }} ms cap, so it can only ever die as a bare `script timeout`: wait in Node instead, with a short DOM-reading `pollInObsidian` `poll`, an `until` evaluated in Node, and the long budget in `timeoutInMilliseconds`.'
    },
    schema: [{
      additionalProperties: false,
      properties: {
        capInMilliseconds: {
          minimum: 1,
          type: 'integer'
        }
      },
      type: 'object'
    }],
    type: 'problem'
  }
};

/**
 * Finds the in-Obsidian closure a node runs inside, walking outwards.
 *
 * The walk does not stop at the first enclosing function: a wait inside a helper declared within the
 * callback still runs inside the callback, so it keeps going until it reaches a function that IS one of
 * the helper's in-Obsidian closures.
 *
 * @param node - The node to start from.
 * @returns The enclosing closure, or `null` when the node does not run inside one.
 */
function findEnclosingEvalClosure(node: TSESTree.Node): EvalClosure | null {
  let currentNode: TSESTree.Node | undefined = node.parent;

  while (currentNode) {
    const closure = readEvalClosure(currentNode);
    if (closure) {
      return closure;
    }
    currentNode = currentNode.parent;
  }

  return null;
}

/**
 * Finds a variable by name, walking outwards from the given scope.
 *
 * @param scope - The scope to start from.
 * @param name - The variable's name.
 * @returns The variable, or `null` when nothing in scope declares that name.
 */
function findVariable(scope: Scope.Scope, name: string): null | Scope.Variable {
  let currentScope: null | Scope.Scope = scope;

  while (currentScope) {
    const variable = currentScope.variables.find((candidate) => candidate.name === name);
    if (variable) {
      return variable;
    }
    currentScope = currentScope.upper;
  }

  return null;
}

/**
 * Checks whether a node is a binary expression.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `BinaryExpression`.
 */
function isBinaryExpression(node: TSESTree.Node): node is TSESTree.BinaryExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'BinaryExpression';
}

/**
 * Checks whether a node is a call expression.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `CallExpression`.
 */
function isCallExpression(node: TSESTree.Node): node is TSESTree.CallExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'CallExpression';
}

/**
 * Checks whether a node is a function written as an object property's value.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `FunctionExpression` or an `ArrowFunctionExpression`.
 */
function isClosureFunction(node: TSESTree.Node): node is ClosureFunction {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
}

/**
 * Checks whether a node is an identifier.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an `Identifier`.
 */
function isIdentifier(node: TSESTree.Node): node is TSESTree.Identifier {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'Identifier';
}

/**
 * Checks whether a node is a numeric literal.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `Literal` holding a number.
 */
function isNumericLiteral(node: TSESTree.Node): node is TSESTree.NumberLiteral {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'Literal' && typeof node.value === 'number';
}

/**
 * Checks whether a node is an object literal.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an `ObjectExpression`.
 */
function isObjectExpression(node: TSESTree.Node): node is TSESTree.ObjectExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'ObjectExpression';
}

/**
 * Checks whether a node is an object destructuring pattern.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an `ObjectPattern`.
 */
function isObjectPattern(node: TSESTree.Node): node is TSESTree.ObjectPattern {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'ObjectPattern';
}

/**
 * Checks whether a node is an object-literal or object-pattern property.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `Property`.
 */
function isProperty(node: TSESTree.Node): node is TSESTree.Property {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'Property';
}

/**
 * Checks whether a node is a variable declarator.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `VariableDeclarator`.
 */
function isVariableDeclarator(node: TSESTree.Node): node is TSESTree.VariableDeclarator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'VariableDeclarator';
}

/**
 * Reads the expression an identifier is bound to.
 *
 * A `const` answers with its initializer; a destructured parameter of THIS closure answers with what the
 * call's own `input` supplies for the key it was destructured by, which is how a budget written once at
 * the call site reaches a closure that can close over nothing.
 *
 * @param node - The identifier to resolve.
 * @param closure - The closure the identifier was written inside.
 * @param context - The rule context, used to resolve the identifier through scope.
 * @returns The expression it is bound to, or `null` when nothing statically binds it.
 */
function readBoundExpression(node: TSESTree.Identifier, closure: EvalClosure, context: Rule.RuleContext): null | TSESTree.Node {
  const variable = findVariable(context.sourceCode.getScope(node), node.name);
  if (!variable) {
    return null;
  }

  for (const definition of variable.defs) {
    const definitionNode = definition.node as TSESTree.Node;

    if (isVariableDeclarator(definitionNode) && definitionNode.init) {
      return definitionNode.init;
    }

    if (definitionNode === closure.closureNode) {
      const inputKey = readParameterInputKey(closure.closureNode, node.name);
      if (inputKey === null) {
        return null;
      }

      return readInputPropertyValue(closure.paramsNode, inputKey);
    }
  }

  return null;
}

/**
 * Reads the closure property names a call's parameter object may carry, by the helper it calls.
 *
 * @param callNode - The call expression.
 * @returns The in-Obsidian closure property names, or `null` when the callee is not one of the helpers.
 */
function readClosureNames(callNode: TSESTree.CallExpression): null | readonly string[] {
  if (!isIdentifier(callNode.callee)) {
    return null;
  }

  return CLOSURE_NAMES_BY_CALLEE_NAME.get(callNode.callee.name) ?? null;
}

/**
 * Reads the in-Obsidian closure a function node is, if it is one.
 *
 * A closure qualifies when it is the value of a `callback` / `poll` / `start` property of the object
 * literal passed as the helper's first argument — which covers both the method shorthand
 * (`async callback({ … }) { … }`) and an arrow (`callback: async ({ … }) => { … }`).
 *
 * @param node - The node to check.
 * @returns The closure, or `null` when the node is not an in-Obsidian closure.
 */
function readEvalClosure(node: TSESTree.Node): EvalClosure | null {
  if (!isClosureFunction(node)) {
    return null;
  }

  const propertyNode = node.parent;
  if (!isProperty(propertyNode)) {
    return null;
  }

  /*
   * The object check comes BEFORE the key check because a function can reach a property through its
   * COMPUTED KEY as well as through its value -- `{ [() => 'a']: 1 }` is legal -- and a destructuring
   * pattern can carry one too. Neither is a helper call's parameter object.
   */
  const paramsNode = propertyNode.parent;
  if (!isObjectExpression(paramsNode)) {
    return null;
  }

  if (!isIdentifier(propertyNode.key)) {
    return null;
  }

  const callNode = paramsNode.parent;
  if (!isCallExpression(callNode) || callNode.arguments[0] !== paramsNode) {
    return null;
  }

  const closureNames = readClosureNames(callNode);
  if (!closureNames?.includes(propertyNode.key.name)) {
    return null;
  }

  return {
    closureNode: node,
    paramsNode,
    reportNode: propertyNode
  };
}

/**
 * Reads the value a call's own `input` object supplies for one key.
 *
 * This is how a budget declared once at the call site reaches the closure, which cannot close over
 * anything: `input: { settleTimeoutInMilliseconds: SETTLE }` arrives destructured in the callback's
 * parameter object.
 *
 * @param paramsNode - The helper's parameter object.
 * @param keyName - The `input` property to read.
 * @returns The expression supplying that key, or `null` when the call's `input` does not declare it.
 */
function readInputPropertyValue(paramsNode: TSESTree.ObjectExpression, keyName: string): null | TSESTree.Node {
  const inputProperty = paramsNode.properties.find((property) =>
    isProperty(property as TSESTree.Node)
    && isIdentifier((property as TSESTree.Property).key as TSESTree.Node)
    && ((property as TSESTree.Property).key as TSESTree.Identifier).name === INPUT_PROPERTY_NAME
  ) as TSESTree.Property | undefined;

  const inputNode = inputProperty?.value as TSESTree.Node | undefined;
  if (!inputNode || !isObjectExpression(inputNode)) {
    return null;
  }

  const valueProperty = inputNode.properties.find((property) =>
    isProperty(property as TSESTree.Node)
    && isIdentifier((property as TSESTree.Property).key as TSESTree.Node)
    && ((property as TSESTree.Property).key as TSESTree.Identifier).name === keyName
  ) as TSESTree.Property | undefined;

  return (valueProperty?.value as TSESTree.Node | undefined) ?? null;
}

/**
 * Reads the `input` key a destructured closure parameter is bound from.
 *
 * The binding may be renamed (`timeoutInMilliseconds: timeout`), so the KEY is what the call's `input`
 * is looked up by, never the local name.
 *
 * @param closureNode - The closure whose parameters to read.
 * @param localName - The name the budget is bound to inside the closure.
 * @returns The `input` key, or `null` when the name is not bound by a plain destructured property.
 */
function readParameterInputKey(closureNode: ClosureFunction, localName: string): null | string {
  for (const parameterNode of closureNode.params) {
    if (!isObjectPattern(parameterNode)) {
      continue;
    }

    for (const property of parameterNode.properties) {
      if (!isProperty(property) || property.computed || !isIdentifier(property.key) || !isIdentifier(property.value)) {
        continue;
      }

      if (property.value.name === localName) {
        return property.key.name;
      }
    }
  }

  return null;
}

/**
 * Reads the expression carrying a wait call's declared budget.
 *
 * @param callNode - The call expression to inspect.
 * @returns The expression to resolve; `null` for a `waitUntil` that omits its timeout, which takes the
 * helper's default; or `undefined` when the call is not a wait at all.
 */
function readWaitBudgetExpression(callNode: TSESTree.CallExpression): null | TSESTree.Node | undefined {
  if (!isIdentifier(callNode.callee)) {
    return undefined;
  }

  const calleeName = callNode.callee.name;

  if (calleeName === SLEEP_CALLEE_NAME) {
    return (callNode.arguments[0]) ?? undefined;
  }

  if (calleeName !== WAIT_UNTIL_CALLEE_NAME) {
    return undefined;
  }

  const paramsNode = callNode.arguments[0] as TSESTree.Node | undefined;
  if (!paramsNode || !isObjectExpression(paramsNode)) {
    return undefined;
  }

  const timeoutProperty = paramsNode.properties.find((property) =>
    isProperty(property as TSESTree.Node)
    && isIdentifier((property as TSESTree.Property).key as TSESTree.Node)
    && ((property as TSESTree.Property).key as TSESTree.Identifier).name === TIMEOUT_PROPERTY_NAME
  ) as TSESTree.Property | undefined;

  return (timeoutProperty?.value) ?? null;
}

/**
 * Resolves an expression to a millisecond count, through scope.
 *
 * Handles a numeric literal, a literal-only product (`60 * 1000`), an identifier bound to either in any
 * enclosing scope, and a destructured closure parameter followed back through the call's own `input`.
 * Anything else is unresolvable and answers `null`, which the caller treats as contributing nothing.
 *
 * Each identifier is resolved from ITS OWN scope rather than from the wait's, so a value supplied by the
 * call's `input` resolves at the call site — where it was written — and is not captured by a same-named
 * binding that happens to exist inside the closure.
 *
 * @param node - The expression to resolve.
 * @param closure - The closure the expression was written inside.
 * @param context - The rule context, used to resolve identifiers through scope.
 * @returns The millisecond count, or `null` when it cannot be resolved statically.
 */
function resolveMilliseconds(node: TSESTree.Node, closure: EvalClosure, context: Rule.RuleContext): null | number {
  const visitedNodes = new Set<TSESTree.Node>();
  let currentNode = node;

  while (!visitedNodes.has(currentNode)) {
    visitedNodes.add(currentNode);

    if (isNumericLiteral(currentNode)) {
      return currentNode.value;
    }

    if (isBinaryExpression(currentNode) && currentNode.operator === '*') {
      const leftInMilliseconds = resolveMilliseconds(currentNode.left, closure, context);
      const rightInMilliseconds = resolveMilliseconds(currentNode.right, closure, context);

      if (leftInMilliseconds === null || rightInMilliseconds === null) {
        return null;
      }

      return leftInMilliseconds * rightInMilliseconds;
    }

    if (!isIdentifier(currentNode)) {
      return null;
    }

    const boundNode = readBoundExpression(currentNode, closure, context);
    if (!boundNode) {
      return null;
    }

    currentNode = boundNode;
  }

  return null;
}
