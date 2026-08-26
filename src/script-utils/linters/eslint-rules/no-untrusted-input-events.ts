/**
 * @file
 *
 * ESLint rule: no-untrusted-input-events
 *
 * Reports an integration test that drives the UI by dispatching an INPUT event —
 * `el.dispatchEvent(new KeyboardEvent(...))`, `new MouseEvent(...)`, and friends.
 *
 * Such an event is untrusted (`isTrusted === false`), and Obsidian and CodeMirror
 * routinely gate on exactly that: Obsidian 1.13's markdown viewport menu opens from
 * a listener guarded by `e.isTrusted`, so a dispatched `contextmenu` reaches nothing.
 * The test then exercises NOTHING while still passing whatever weaker assertion it
 * makes — a false-confidence failure, not a flake.
 *
 * The trusted alternatives — `pressKey`, `clickElement`, `clickMouse`, `hoverElement`,
 * `typeIntoEditor` — are seeded into the `evalInObsidian` callback's `lib` bag, and are
 * also importable from `obsidian-dev-utils/obsidian/desktop-trusted-input`.
 *
 * NOTIFICATION events are deliberately NOT reported. `new Event('input')` after setting
 * an element's `.value` is telling the app about a change rather than pretending to be a
 * user, and nothing gates it on `isTrusted`.
 *
 * Not every dispatch is wrong, so the rule is meant to be disabled — with a reason — at
 * the sites that have one: a drag sequence, which `sendInputEvent` cannot express at all;
 * an Android file, which has no `window.electron` to reach the helpers through; and a
 * listener that is the plugin's own and checks nothing but the key. `require-description`
 * makes that reason mandatory, which is the point: the rule turns an invisible assumption
 * into a written one.
 */
import type { TSESTree } from '@typescript-eslint/utils';
import type {
  Rule,
  Scope
} from 'eslint';

/**
Message ID reported when an integration test drives the UI with a dispatched input event.
 */
export const MESSAGE_ID = 'noUntrustedInputEvents';

/**
 * What to do instead, per event constructor. An event absent from this map is a
 * notification rather than simulated input, and is left alone.
 */
const ADVICE_BY_EVENT_NAME = new Map<string, string>([
  ['DragEvent', 'there is no trusted equivalent, because `sendInputEvent` cannot express a drag, so keep the dispatch and disable this rule with the reason'],
  ['KeyboardEvent', 'use `pressKey`, focusing the target first, since a trusted key press goes to whatever holds DOM focus'],
  ['MouseEvent', 'use `clickElement`, or `clickMouse` when the point to click is not an element centre'],
  ['PointerEvent', 'use `clickElement`, or `clickMouse` when the point to click is not an element centre'],
  ['TouchEvent', 'there is no trusted equivalent, so keep the dispatch and disable this rule with the reason'],
  ['WheelEvent', 'there is no trusted equivalent, so keep the dispatch and disable this rule with the reason']
]);

/**
 * ESLint rule disallowing untrusted input events in integration tests, where they can silently exercise nothing.
 */
export const noUntrustedInputEvents: Rule.RuleModule = {
  create(context) {
    return {
      'CallExpression'(node: Rule.Node): void {
        const callNode = node as TSESTree.CallExpression;

        if (!isDispatchEventCall(callNode)) {
          return;
        }

        const argument = callNode.arguments[0];
        if (!argument) {
          return;
        }

        const eventName = resolveEventName(argument, node, context);
        if (eventName === null) {
          return;
        }

        const advice = ADVICE_BY_EVENT_NAME.get(eventName);
        if (advice === undefined) {
          return;
        }

        context.report({
          data: {
            advice,
            eventName
          },
          messageId: MESSAGE_ID,
          node
        });
      }
    };
  },
  meta: {
    docs: {
      description: 'Disallow driving integration tests with dispatched (untrusted) input events'
    },
    messages: {
      [MESSAGE_ID]: 'A dispatched {{ eventName }} is untrusted (`isTrusted === false`) and Obsidian may ignore it, so this can exercise nothing while still passing: {{ advice }}.'
    },
    schema: [],
    type: 'problem'
  }
};

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
 * Checks whether a call expression is a `.dispatchEvent(...)` call.
 *
 * @param node - The call expression node.
 * @returns `true` if the call is `<something>.dispatchEvent(...)`.
 */
function isDispatchEventCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (callee.type !== 'MemberExpression') {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return callee.property.type === 'Identifier' && callee.property.name === 'dispatchEvent';
}

/**
 * Reads the identifier a `new ...()` expression constructs.
 *
 * @param node - The `NewExpression` node.
 * @returns The constructor's name, or `null` when the callee is not a bare identifier.
 */
function readConstructorName(node: TSESTree.NewExpression): null | string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (node.callee.type !== 'Identifier') {
    return null;
  }

  return node.callee.name;
}

/**
 * Reads the constructor name of the event being dispatched.
 *
 * Handles the argument written inline (`dispatchEvent(new MouseEvent(...))`) and the
 * argument held in a variable (`const e = new DragEvent(...); el.dispatchEvent(e)`),
 * which is how a sequence sharing one `DataTransfer` is usually written.
 *
 * @param argument - The first argument of the `dispatchEvent` call.
 * @param node - The call node, used to resolve the enclosing scope.
 * @param context - The rule context.
 * @returns The constructor name, or `null` when it cannot be determined.
 */
function resolveEventName(argument: TSESTree.Node, node: Rule.Node, context: Rule.RuleContext): null | string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (argument.type === 'NewExpression') {
    return readConstructorName(argument);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  if (argument.type !== 'Identifier') {
    return null;
  }

  const variable = findVariable(context.sourceCode.getScope(node), argument.name);
  if (!variable) {
    return null;
  }

  for (const definition of variable.defs) {
    const definitionNode = definition.node as TSESTree.Node;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
    if (definitionNode.type !== 'VariableDeclarator' || !definitionNode.init) {
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
    if (definitionNode.init.type === 'NewExpression') {
      return readConstructorName(definitionNode.init);
    }
  }

  return null;
}
