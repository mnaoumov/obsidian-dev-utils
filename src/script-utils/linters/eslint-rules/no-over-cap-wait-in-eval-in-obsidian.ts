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
 * closure asking for more time than exists. That misdiagnosis cost two days.
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
 * runs inside -- once per CALL SITE, per the HELPERS paragraph below.
 *
 * WHAT DOES NOT. A budget that cannot be resolved to a number contributes nothing and is
 * never reported (owner, 2026-09-09). Scope analysis resolves the shapes that actually
 * occur — a literal, a `const` in any enclosing scope, and a destructured callback
 * parameter followed back through the call's own `input` object — and resolving through
 * scope rather than by regex is the whole reason this is a rule and not a script. But a
 * value arriving from a caller (`options.timeout ?? DEFAULT`, threaded through a
 * parameter) would need analysis across call boundaries, and reporting every such site would
 * make each legitimately parameterized helper red across thirty repos.
 *
 * LOOPS were once out of scope wholesale, on the reasoning that a `sleep` in a `while` has no
 * statically declared ceiling. That is true of `while (true)` and false of the loop these
 * suites actually write, which declares its ceiling as plainly as any literal timeout — and
 * leaving them all out hid 22 over-cap closures across six repos, one of them ten times over.
 * Two shapes are read now, both through the same scope walk a budget uses:
 *
 * - A DEADLINE loop — `const deadline = Date.now() + BUDGET`, guarded by `Date.now() < deadline` —
 *   cannot run longer than `BUDGET` whatever its poll interval, so `BUDGET` is charged to the
 *   closure ONCE per loop, on top of the single iteration its inner waits are already charged
 *   (a poll that starts just under the deadline still runs to completion, so the sum of the two
 *   is the honest worst case rather than a double count). `performance.now()` counts as well as
 *   `Date.now()`: a `performance`-written deadline read as unbounded is why one 245 025 ms
 *   closure was absent from every roster produced before this.
 * - A COUNTING `for` — `for (let attempt = 0; attempt < ATTEMPTS; attempt++)` — multiplies every
 *   wait inside it by its iteration count, read from the loop's own start, bound and step.
 *
 * Either ceiling may be ONE CONJUNCT of a compound test (`while (count < expected && Date.now() < deadline)`,
 * `for (let attempt = 0; attempt < ATTEMPTS && !isOpen; attempt++)`), which is how both are actually
 * written: a progress condition beside the guard does not remove the ceiling the other conjunct declares.
 *
 * Anything else keeps the old per-iteration charge rather than a guess — `while (true)`, a `for…of`,
 * a bound or deadline that does not resolve — which is what keeps a genuinely unbounded loop silent.
 *
 * A HELPER declared inside the closure is charged once per CALL SITE, which is how many times its waiting
 * actually runs. Its own waits are summed once and multiplied by the calls that reach it, each call
 * carrying the counting loops it is itself written inside — so a local `waitUntil(check)` of
 * `for (attempt < 40) await sleep(250)` called three times declares 30 000 ms rather than the 10 000 ms a
 * single attribution reported. Three bounds keep that honest:
 *
 * - A helper declared OUTSIDE the closure stays out of scope, for the same reason a budget arriving from
 *   a caller is: reading it needs analysis across call boundaries, and widening there would make every
 *   legitimately parameterized helper in every consuming repo red.
 * - RECURSION terminates by charging a re-entered helper nothing, so neither a self-call nor a mutually
 *   recursive pair is charged forever. A recursive call contributes the silence an unbounded loop does.
 * - A helper the closure never REACHES — dead, or called through something this rule cannot resolve, such
 *   as a bare reference handed to `forEach` — keeps the flat single charge it has always had. So no
 *   closure this rule reports today falls silent because a call site could not be read.
 *
 * What the per-call-site count does NOT fix is a BRANCHY helper: an `if` / `else` is summed lexically like
 * any two sibling waits, so both arms are charged at every call site. A helper whose two directions wait
 * differently is therefore better written as two helpers, which is what this repo's own
 * `src/obsidian/components/syntax-highlighting-component.obsidian.integration.test.ts` now does.
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
 * The clocks a deadline may be taken from. Both occur in these suites, and a rule that knew only `Date`
 * read every `performance`-written deadline as unbounded.
 */
const CLOCK_OBJECT_NAMES = new Set(['Date', 'performance']);

const NOW_METHOD_NAME = 'now';

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
 * Everything one file accumulated, keyed by the function each charge was written inside.
 *
 * A wait is charged to the innermost function it is written in rather than straight to the closure, and a
 * call to a helper the closure declares is recorded as an edge, so a closure's total is its own waiting
 * plus each helper's waiting multiplied by the calls that actually reach it.
 */
interface CallGraph {
  /**
   * How many times each function calls each helper declared inside the same closure.
   */
  readonly callCountByCalleeNodeByCallerNode: Map<HelperFunction, Map<HelperFunction, number>>;

  /**
   * The closures seen so far, by the function node each one is written as.
   */
  readonly stateByClosureNode: Map<ClosureFunction, ClosureState>;

  /**
   * The waiting written DIRECTLY inside each function, excluding whatever the helpers it calls declare.
   */
  readonly waitInMillisecondsByFunctionNode: Map<HelperFunction, number>;
}

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
 * The function a charge is attributed to, together with the in-Obsidian closure it ultimately runs inside.
 */
interface ChargeTarget {
  /**
   * The closure the charge runs inside, carried so a budget threaded through its call still resolves.
   */
  readonly closure: EvalClosure;

  /**
   * The innermost function the charge is written in: the closure itself, or a helper declared within it.
   */
  readonly functionNode: HelperFunction;
}

/**
 * A function written as an object property, which is the only form either helper's closures take.
 */
type ClosureFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;

/**
 * One in-Obsidian closure's accumulated charges.
 */
interface ClosureState {
  /**
   * The closure's own function node, the root every reachable helper is counted from.
   */
  readonly closureNode: ClosureFunction;

  /**
   * Every function charged inside this closure: the closure itself, and each helper it declares.
   */
  readonly functionNodes: Set<HelperFunction>;

  /**
   * The property the closure is written as, reported on.
   */
  readonly reportNode: TSESTree.Node;
}

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
 * A function waiting can be charged to: an in-Obsidian closure, or a helper declared inside one — which a
 * `function` declaration is as readily as an arrow or a function expression.
 */
type HelperFunction = ClosureFunction | TSESTree.FunctionDeclaration;

/**
 * A loop whose own test can declare a ceiling. `for…of` / `for…in` are deliberately absent: neither
 * declares one statically, so both keep the per-iteration charge every unsized loop gets.
 */
type LoopStatement = TSESTree.DoWhileStatement | TSESTree.ForStatement | TSESTree.WhileStatement;

/**
 * ESLint rule disallowing an in-Obsidian closure whose declared waiting exceeds the transport's script-timeout cap.
 */
export const noOverCapWaitInEvalInObsidian: Rule.RuleModule = {
  create(context) {
    const options = context.options[0] as CapOptions | undefined;
    const capInMilliseconds = options?.capInMilliseconds ?? DEFAULT_CAP_IN_MILLISECONDS;
    const callGraph: CallGraph = {
      callCountByCalleeNodeByCallerNode: new Map<HelperFunction, Map<HelperFunction, number>>(),
      stateByClosureNode: new Map<ClosureFunction, ClosureState>(),
      waitInMillisecondsByFunctionNode: new Map<HelperFunction, number>()
    };

    /**
     * Records that one function calls a helper declared inside the same closure.
     *
     * @param target - The function the call is written in.
     * @param calleeNode - The helper being called.
     * @param callCount - How many times the call runs, as the product of its enclosing counting loops.
     */
    function addCall(target: ChargeTarget, calleeNode: HelperFunction, callCount: number): void {
      const state = readClosureState(target);
      state.functionNodes.add(calleeNode);

      const callCountByCalleeNode = callGraph.callCountByCalleeNodeByCallerNode.get(target.functionNode)
        ?? new Map<HelperFunction, number>();
      callGraph.callCountByCalleeNodeByCallerNode.set(target.functionNode, callCountByCalleeNode);
      callCountByCalleeNode.set(calleeNode, (callCountByCalleeNode.get(calleeNode) ?? 0) + callCount);
    }

    /**
     * Adds waiting to the running total of the function it was written in.
     *
     * @param target - The function to charge.
     * @param waitInMilliseconds - The waiting to add.
     */
    function addWait(target: ChargeTarget, waitInMilliseconds: number): void {
      readClosureState(target);
      const runningTotalInMilliseconds = callGraph.waitInMillisecondsByFunctionNode.get(target.functionNode) ?? 0;
      callGraph.waitInMillisecondsByFunctionNode.set(target.functionNode, runningTotalInMilliseconds + waitInMilliseconds);
    }

    /**
     * Records a call to a helper the closure declares, so its waiting is counted once per call site.
     *
     * @param callNode - The call expression.
     * @param target - The function the call is written in.
     */
    function chargeHelperCall(callNode: TSESTree.CallExpression, target: ChargeTarget): void {
      const helperNode = readCalledHelperNode(callNode, target.closure, context);
      if (!helperNode) {
        return;
      }

      addCall(target, helperNode, readLoopMultiplier(callNode, target, context));
    }

    /**
     * Charges a deadline-bounded loop its whole deadline, once.
     *
     * @param node - The loop statement.
     */
    function chargeLoopDeadline(node: Rule.Node): void {
      const loopNode = node as LoopStatement;

      const target = findChargeTarget(loopNode);
      if (!target) {
        return;
      }

      const deadlineInMilliseconds = readLoopDeadlineInMilliseconds(loopNode, target.closure, context);
      if (deadlineInMilliseconds === null) {
        return;
      }

      addWait(target, deadlineInMilliseconds * readLoopMultiplier(loopNode, target, context));
    }

    /**
     * Charges a wait call the budget it declares.
     *
     * @param callNode - The call expression.
     * @param target - The function the call is written in.
     */
    function chargeWaitCall(callNode: TSESTree.CallExpression, target: ChargeTarget): void {
      const budgetExpression = readWaitBudgetExpression(callNode);
      if (budgetExpression === undefined) {
        return;
      }

      const waitInMilliseconds = budgetExpression === null
        ? WAIT_UNTIL_DEFAULT_TIMEOUT_IN_MILLISECONDS
        : resolveNumber(budgetExpression, target.closure, context);
      if (waitInMilliseconds === null) {
        return;
      }

      addWait(target, waitInMilliseconds * readLoopMultiplier(callNode, target, context));
    }

    /**
     * Registers the closure a charge belongs to, and the function the charge was written in.
     *
     * @param target - The function being charged.
     * @returns That closure's accumulated state.
     */
    function readClosureState(target: ChargeTarget): ClosureState {
      const state = callGraph.stateByClosureNode.get(target.closure.closureNode) ?? {
        closureNode: target.closure.closureNode,
        functionNodes: new Set<HelperFunction>(),
        reportNode: target.closure.reportNode
      };
      callGraph.stateByClosureNode.set(target.closure.closureNode, state);
      state.functionNodes.add(target.functionNode);
      return state;
    }

    return {
      'CallExpression'(node: Rule.Node): void {
        const callNode = node as TSESTree.CallExpression;

        const target = findChargeTarget(callNode);
        if (!target) {
          return;
        }

        chargeWaitCall(callNode, target);
        chargeHelperCall(callNode, target);
      },
      DoWhileStatement: chargeLoopDeadline,
      ForStatement: chargeLoopDeadline,
      'Program:exit'(): void {
        for (const state of callGraph.stateByClosureNode.values()) {
          const totalInMilliseconds = readClosureWaitInMilliseconds(state, callGraph);
          if (totalInMilliseconds < capInMilliseconds) {
            continue;
          }

          context.report({
            data: {
              capInMilliseconds: String(capInMilliseconds),
              totalInMilliseconds: String(totalInMilliseconds)
            },
            messageId: MESSAGE_ID,
            node: state.reportNode
          });
        }
      },
      WhileStatement: chargeLoopDeadline
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
 * Collects every helper reachable from a function by following the calls recorded for its closure.
 *
 * A helper NOT in the answer is one no call site can reach, which is what the flat fallback charge is
 * keyed off: it is either dead, or called through something this rule cannot read.
 *
 * @param functionNode - The function to start from.
 * @param callGraph - The file's accumulated charges.
 * @param reachableNodes - The set to collect into, which doubles as the visited set.
 */
function collectReachableFunctionNodes(functionNode: HelperFunction, callGraph: CallGraph, reachableNodes: Set<HelperFunction>): void {
  if (reachableNodes.has(functionNode)) {
    return;
  }

  reachableNodes.add(functionNode);

  for (const calleeNode of callGraph.callCountByCalleeNodeByCallerNode.get(functionNode)?.keys() ?? []) {
    collectReachableFunctionNodes(calleeNode, callGraph, reachableNodes);
  }
}

/**
 * Finds the function a node's waiting is charged to, walking outwards.
 *
 * The walk does not stop at the first enclosing function: a wait inside a helper declared within the
 * callback still runs inside the callback, so it keeps going until it reaches a function that IS one of
 * the helper's in-Obsidian closures. What it REMEMBERS on the way is the innermost function it passed, so
 * a helper's waiting is accumulated against the helper and charged to the closure once per call site.
 *
 * @param node - The node to start from.
 * @returns The charge target, or `null` when the node does not run inside an in-Obsidian closure.
 */
function findChargeTarget(node: TSESTree.Node): ChargeTarget | null {
  let innermostFunctionNode: HelperFunction | undefined;
  let currentNode: TSESTree.Node | undefined = node.parent;

  while (currentNode) {
    const closure = readEvalClosure(currentNode);
    if (closure) {
      return {
        closure,
        functionNode: innermostFunctionNode ?? closure.closureNode
      };
    }

    if (!innermostFunctionNode && isFunctionNode(currentNode)) {
      innermostFunctionNode = currentNode;
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
 * Checks whether a node is an assignment expression.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an `AssignmentExpression`.
 */
function isAssignmentExpression(node: TSESTree.Node): node is TSESTree.AssignmentExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'AssignmentExpression';
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
 * Checks whether a function is declared somewhere inside an in-Obsidian closure.
 *
 * A helper declared OUTSIDE the closure answers `false`, which is what keeps this rule's analysis inside
 * one closure rather than following calls across boundaries it deliberately declines to read.
 *
 * @param functionNode - The function to check.
 * @param closure - The closure to check against.
 * @returns `true` when the function is declared lexically inside the closure.
 */
function isDeclaredInsideClosure(functionNode: HelperFunction, closure: EvalClosure): boolean {
  let currentNode: TSESTree.Node | undefined = functionNode.parent;

  while (currentNode) {
    if (currentNode === closure.closureNode) {
      return true;
    }
    currentNode = currentNode.parent;
  }

  return false;
}

/**
 * Checks whether a node is a counting `for` statement.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `ForStatement`.
 */
function isForStatement(node: TSESTree.Node): node is TSESTree.ForStatement {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'ForStatement';
}

/**
 * Checks whether a node is a function waiting can be charged to.
 *
 * A `function` declaration counts as well as the two expression forms, because that is how these suites
 * write a local retry helper.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `FunctionDeclaration`, a `FunctionExpression` or an `ArrowFunctionExpression`.
 */
function isFunctionNode(node: TSESTree.Node): node is HelperFunction {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return isClosureFunction(node) || node.type === 'FunctionDeclaration';
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
 * Checks whether a node is an `&&` chain, whose conjuncts a ceiling may be declared in one of.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `LogicalExpression` with the `&&` operator.
 */
function isLogicalAndExpression(node: TSESTree.Node): node is TSESTree.LogicalExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'LogicalExpression' && node.operator === '&&';
}

/**
 * Checks whether a node is a loop whose own test can declare a ceiling.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `WhileStatement`, a `DoWhileStatement` or a `ForStatement`.
 */
function isLoopStatement(node: TSESTree.Node): node is LoopStatement {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'WhileStatement' || node.type === 'DoWhileStatement' || isForStatement(node);
}

/**
 * Checks whether a node is a member expression.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `MemberExpression`.
 */
function isMemberExpression(node: TSESTree.Node): node is TSESTree.MemberExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'MemberExpression';
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
 * Checks whether a node is an update expression.
 *
 * @param node - The node to check.
 * @returns `true` if the node is an `UpdateExpression`.
 */
function isUpdateExpression(node: TSESTree.Node): node is TSESTree.UpdateExpression {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'UpdateExpression';
}

/**
 * Checks whether a node is a variable declaration.
 *
 * @param node - The node to check.
 * @returns `true` if the node is a `VariableDeclaration`.
 */
function isVariableDeclaration(node: TSESTree.Node): node is TSESTree.VariableDeclaration {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- AST node type string literals match the TSESTree enum values.
  return node.type === 'VariableDeclaration';
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
 * Reads the helper a call names, when that helper is declared inside the given closure.
 *
 * Both forms these suites write are resolved through the same scope walk a budget uses: a `function`
 * declaration, and a `const` bound to an arrow or a function expression.
 *
 * @param callNode - The call expression.
 * @param closure - The in-Obsidian closure the call runs inside.
 * @param context - The rule context, used to resolve the callee through scope.
 * @returns The helper's function node, or `null` when the callee is not a helper of this closure.
 */
function readCalledHelperNode(callNode: TSESTree.CallExpression, closure: EvalClosure, context: Rule.RuleContext): HelperFunction | null {
  const calleeNode = callNode.callee as TSESTree.Node;
  if (!isIdentifier(calleeNode)) {
    return null;
  }

  const variable = findVariable(context.sourceCode.getScope(calleeNode), calleeNode.name);
  if (!variable) {
    return null;
  }

  for (const definition of variable.defs) {
    const functionNode = readDefinitionFunctionNode(definition.node as TSESTree.Node);
    if (functionNode && isDeclaredInsideClosure(functionNode, closure)) {
      return functionNode;
    }
  }

  return null;
}

/**
 * Sums a function's own waiting plus that of every helper it calls, multiplied by the calls that reach it.
 *
 * A function already on the stack contributes NOTHING, which is what terminates direct and mutual
 * recursion — the same silence an unbounded loop gets, rather than a guess at how often it repeats. The
 * stack is unwound on the way out, so a helper reached down two different paths is counted on both.
 *
 * @param functionNode - The function to total.
 * @param callGraph - The file's accumulated charges.
 * @param visitedNodes - The functions currently being totalled, which is the recursion stack.
 * @returns The waiting, in milliseconds.
 */
function readCallGraphWaitInMilliseconds(functionNode: HelperFunction, callGraph: CallGraph, visitedNodes: Set<HelperFunction>): number {
  if (visitedNodes.has(functionNode)) {
    return 0;
  }

  visitedNodes.add(functionNode);

  let totalInMilliseconds = callGraph.waitInMillisecondsByFunctionNode.get(functionNode) ?? 0;
  for (const [calleeNode, callCount] of callGraph.callCountByCalleeNodeByCallerNode.get(functionNode) ?? []) {
    totalInMilliseconds += callCount * readCallGraphWaitInMilliseconds(calleeNode, callGraph, visitedNodes);
  }

  visitedNodes.delete(functionNode);
  return totalInMilliseconds;
}

/**
 * Reads the clock a node reads the current time from, if that is what it does.
 *
 * @param node - The node to inspect.
 * @returns The clock object's name (`Date` or `performance`), or `null` when the node is not a clock reading.
 */
function readClockName(node: TSESTree.Node): null | string {
  if (!isCallExpression(node) || node.arguments.length > 0) {
    return null;
  }

  const calleeNode = node.callee as TSESTree.Node;
  if (!isMemberExpression(calleeNode) || calleeNode.computed) {
    return null;
  }

  const objectNode = calleeNode.object as TSESTree.Node;
  const propertyNode = calleeNode.property as TSESTree.Node;
  if (!isIdentifier(objectNode) || !isIdentifier(propertyNode)) {
    return null;
  }

  if (propertyNode.name !== NOW_METHOD_NAME || !CLOCK_OBJECT_NAMES.has(objectNode.name)) {
    return null;
  }

  return objectNode.name;
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
 * Reads one closure's whole declared waiting.
 *
 * Everything the closure can REACH is totalled through the call graph, once per call site. Everything it
 * cannot — a helper nothing calls, or one called through a reference this rule cannot follow — keeps the
 * flat single charge a lexical attribution always gave it, so no closure reported before this rule counted
 * call sites falls silent now that it does.
 *
 * @param state - The closure's accumulated charges.
 * @param callGraph - The file's accumulated charges.
 * @returns The waiting the closure declares, in milliseconds.
 */
function readClosureWaitInMilliseconds(state: ClosureState, callGraph: CallGraph): number {
  const reachableNodes = new Set<HelperFunction>();
  collectReachableFunctionNodes(state.closureNode, callGraph, reachableNodes);

  let totalInMilliseconds = readCallGraphWaitInMilliseconds(state.closureNode, callGraph, new Set<HelperFunction>());

  for (const functionNode of state.functionNodes) {
    const ownWaitInMilliseconds = callGraph.waitInMillisecondsByFunctionNode.get(functionNode);
    if (ownWaitInMilliseconds === undefined || reachableNodes.has(functionNode)) {
      continue;
    }

    totalInMilliseconds += ownWaitInMilliseconds;
  }

  return totalInMilliseconds;
}

/**
 * Flattens an `&&` chain into the conditions it is built from.
 *
 * A test that is not an `&&` chain answers with itself, so a caller never special-cases the simple form.
 *
 * @param node - The expression to flatten.
 * @returns Every conjunct, left to right.
 */
function readConjuncts(node: TSESTree.Expression): TSESTree.Expression[] {
  if (!isLogicalAndExpression(node)) {
    return [node];
  }

  return [...readConjuncts(node.left), ...readConjuncts(node.right)];
}

/**
 * Reads the ceiling a single `clock.now() < deadline` comparison declares.
 *
 * Both operand orders are read, since `deadline > clock.now()` is the same guard written the other way
 * round. The binding must take its time from the SAME clock as the guard: a comparison across the two
 * measures nothing, and declining it is the silence any unresolvable value already gets.
 *
 * @param node - The condition to inspect.
 * @param closure - The in-Obsidian closure the loop runs inside.
 * @param context - The rule context, used to resolve the deadline through scope.
 * @returns The ceiling in milliseconds, or `null` when the condition declares none.
 */
function readDeadlineGuardInMilliseconds(node: TSESTree.Node, closure: EvalClosure, context: Rule.RuleContext): null | number {
  if (!isBinaryExpression(node)) {
    return null;
  }

  const isClockOnLeft = node.operator === '<' || node.operator === '<=';
  if (!isClockOnLeft && node.operator !== '>' && node.operator !== '>=') {
    return null;
  }

  const clockName = readClockName(isClockOnLeft ? node.left : node.right);
  const deadlineNode = (isClockOnLeft ? node.right : node.left) as TSESTree.Node;
  if (clockName === null || !isIdentifier(deadlineNode)) {
    return null;
  }

  const boundNode = readBoundExpression(deadlineNode, closure, context);
  if (!boundNode || !isBinaryExpression(boundNode) || boundNode.operator !== '+') {
    return null;
  }

  if (readClockName(boundNode.left) !== clockName) {
    return null;
  }

  return resolveNumber(boundNode.right, closure, context);
}

/**
 * Reads the function a scope definition declares, if it declares one.
 *
 * @param definitionNode - The node a variable's definition points at.
 * @returns The function it declares, or `null` when the name is bound to anything else.
 */
function readDefinitionFunctionNode(definitionNode: TSESTree.Node): HelperFunction | null {
  if (isFunctionNode(definitionNode)) {
    return definitionNode;
  }

  if (!isVariableDeclarator(definitionNode) || !definitionNode.init) {
    return null;
  }

  const initNode = definitionNode.init as TSESTree.Node;
  return isFunctionNode(initNode) ? initNode : null;
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
 * Reads the whole-loop ceiling a clock deadline declares, in milliseconds.
 *
 * The guard is looked for among the test's `&&` conjuncts rather than as the whole test, because the
 * loops that carry one pair it with a progress condition — `while (count < expected && Date.now() < deadline)`
 * — and a compound test must not remove a ceiling one of its conjuncts plainly declares.
 *
 * @param loopNode - The loop to inspect.
 * @param closure - The in-Obsidian closure the loop runs inside.
 * @param context - The rule context, used to resolve the deadline through scope.
 * @returns The ceiling in milliseconds, or `null` when the loop declares none.
 */
function readLoopDeadlineInMilliseconds(loopNode: LoopStatement, closure: EvalClosure, context: Rule.RuleContext): null | number {
  if (!loopNode.test) {
    return null;
  }

  for (const conjunct of readConjuncts(loopNode.test)) {
    const deadlineInMilliseconds = readDeadlineGuardInMilliseconds(conjunct, closure, context);
    if (deadlineInMilliseconds !== null) {
      return deadlineInMilliseconds;
    }
  }

  return null;
}

/**
 * Reads the first value a loop's test will not let its counter reach.
 *
 * An inclusive bound answers one higher than it is written, so a caller works in one currency rather than
 * carrying the operator along with the number. The test is read as `&&` conjuncts for the same reason a
 * deadline guard is: `attempt < ATTEMPTS && !isOpen` still cannot run more than `ATTEMPTS` times.
 *
 * @param testNode - The loop's test.
 * @param counterName - The name of the counter the loop advances.
 * @param closure - The in-Obsidian closure the loop runs inside.
 * @param context - The rule context, used to resolve the bound through scope.
 * @returns The exclusive bound, or `null` when no conjunct bounds that counter by a resolvable number.
 */
function readLoopExclusiveBound(
  testNode: TSESTree.Expression,
  counterName: string,
  closure: EvalClosure,
  context: Rule.RuleContext
): null | number {
  for (const conjunct of readConjuncts(testNode)) {
    if (!isBinaryExpression(conjunct) || (conjunct.operator !== '<' && conjunct.operator !== '<=')) {
      continue;
    }

    const counterNode = conjunct.left as TSESTree.Node;
    if (!isIdentifier(counterNode) || counterNode.name !== counterName) {
      continue;
    }

    const boundValue = resolveNumber(conjunct.right, closure, context);
    if (boundValue === null) {
      continue;
    }

    return conjunct.operator === '<' ? boundValue : boundValue + 1;
  }

  return null;
}

/**
 * Reads how many times a counting `for` runs.
 *
 * The bound is read from the same `&&` conjuncts a deadline is, for the same reason:
 * `attempt < ATTEMPTS && !isOpen` still cannot run more than `ATTEMPTS` times. The STEP is read rather
 * than presumed to be one, or a `for (let elapsed = 0; elapsed < BUDGET; elapsed += INTERVAL)` poll would
 * be counted `BUDGET` times.
 *
 * @param loopNode - The loop to inspect.
 * @param closure - The in-Obsidian closure the loop runs inside.
 * @param context - The rule context, used to resolve the start, bound and step through scope.
 * @returns The iteration count, or `null` when it is not statically knowable.
 */
function readLoopIterationCount(loopNode: LoopStatement, closure: EvalClosure, context: Rule.RuleContext): null | number {
  if (!isForStatement(loopNode) || !loopNode.test || !loopNode.init || !isVariableDeclaration(loopNode.init)) {
    return null;
  }

  const declaratorNodes = loopNode.init.declarations;
  const declaratorNode = declaratorNodes.length === 1 ? declaratorNodes[0] : undefined;
  if (!declaratorNode?.init || !isIdentifier(declaratorNode.id)) {
    return null;
  }

  const startValue = resolveNumber(declaratorNode.init, closure, context);
  const stepSize = readLoopStepSize(loopNode.update, declaratorNode.id, closure, context);
  const boundValue = readLoopExclusiveBound(loopNode.test, declaratorNode.id.name, closure, context);
  if (startValue === null || stepSize === null || stepSize <= 0 || boundValue === null) {
    return null;
  }

  const span = boundValue - startValue;
  return span > 0 ? Math.ceil(span / stepSize) : 0;
}

/**
 * Reads how many times something written at a node actually runs, as the product of its enclosing loops.
 *
 * A loop that is not statically countable contributes a factor of ONE rather than disqualifying the sum:
 * that is the per-iteration charge this rule has always made, and it is what keeps an unbounded
 * `while (true)` silent instead of guessed at. A DEADLINE-bounded loop contributes one as well, because
 * its whole-loop ceiling is charged separately and multiplying too would count the same waiting twice.
 *
 * The walk stops at the function the node is CHARGED to, not at the closure, so the loops around a helper's
 * own waits and the loops around each call to that helper are counted once each rather than twice.
 *
 * @param node - The node to count the runs of.
 * @param target - The function the node is charged to.
 * @param context - The rule context, used to resolve loop bounds through scope.
 * @returns The multiplier, never less than one.
 */
function readLoopMultiplier(node: TSESTree.Node, target: ChargeTarget, context: Rule.RuleContext): number {
  const closure = target.closure;
  let multiplier = 1;
  let currentNode: TSESTree.Node | undefined = node.parent;

  while (currentNode && currentNode !== target.functionNode) {
    if (isLoopStatement(currentNode) && readLoopDeadlineInMilliseconds(currentNode, closure, context) === null) {
      const iterationCount = readLoopIterationCount(currentNode, closure, context);
      if (iterationCount !== null) {
        multiplier *= iterationCount;
      }
    }
    currentNode = currentNode.parent;
  }

  return multiplier;
}

/**
 * Reads how far a counting loop's variable advances each iteration.
 *
 * @param updateNode - The loop's update expression.
 * @param counterNode - The identifier the loop counts on.
 * @param closure - The in-Obsidian closure the loop runs inside.
 * @param context - The rule context, used to resolve a non-literal step through scope.
 * @returns The step, or `null` when the update is not a plain advance of the loop's own counter.
 */
function readLoopStepSize(
  updateNode: null | TSESTree.Expression,
  counterNode: TSESTree.Identifier,
  closure: EvalClosure,
  context: Rule.RuleContext
): null | number {
  if (!updateNode) {
    return null;
  }

  if (isUpdateExpression(updateNode)) {
    const argumentNode = updateNode.argument as TSESTree.Node;
    return updateNode.operator === '++' && isIdentifier(argumentNode) && argumentNode.name === counterNode.name ? 1 : null;
  }

  if (!isAssignmentExpression(updateNode) || updateNode.operator !== '+=') {
    return null;
  }

  const targetNode = updateNode.left as TSESTree.Node;
  if (!isIdentifier(targetNode) || targetNode.name !== counterNode.name) {
    return null;
  }

  return resolveNumber(updateNode.right, closure, context);
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
 * Resolves an expression to a number, through scope.
 *
 * Every number the rule reads comes through here — a wait's budget, a loop's deadline, and a counting
 * loop's start, bound and step — which is why it is named for what it resolves rather than for
 * milliseconds.
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
 * @returns The number, or `null` when it cannot be resolved statically.
 */
function resolveNumber(node: TSESTree.Node, closure: EvalClosure, context: Rule.RuleContext): null | number {
  const visitedNodes = new Set<TSESTree.Node>();
  let currentNode = node;

  while (!visitedNodes.has(currentNode)) {
    visitedNodes.add(currentNode);

    if (isNumericLiteral(currentNode)) {
      return currentNode.value;
    }

    if (isBinaryExpression(currentNode) && currentNode.operator === '*') {
      const leftValue = resolveNumber(currentNode.left, closure, context);
      const rightValue = resolveNumber(currentNode.right, closure, context);

      if (leftValue === null || rightValue === null) {
        return null;
      }

      return leftValue * rightValue;
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
