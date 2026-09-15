import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID,
  noOverCapWaitInEvalInObsidian
} from './no-over-cap-wait-in-eval-in-obsidian.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('no-over-cap-wait-in-eval-in-obsidian', toRuleTesterModule(noOverCapWaitInEvalInObsidian), {
  invalid: [
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a single wait declaring exactly the cap, which leaves the closure no headroom for its own work'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30_000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a separator literal, which is how the over-cap sites are actually written'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 20000 }); await waitUntil({ timeoutInMilliseconds: 20000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'two sibling waits, each under the cap, that only blow it together'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { const BIG_TIMEOUT_IN_MILLISECONDS = 30000; await waitUntil({ timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a budget held in a const inside the closure, the dominant shape in real suites'
    },
    {
      code: 'const BIG_TIMEOUT_IN_MILLISECONDS = 30000; evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: BIG_TIMEOUT_IN_MILLISECONDS }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a const declared in an OUTER scope, so the lookup has to walk upwards'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30 * 1000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a literal-only product'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil }, timeoutInMilliseconds: timeout }) { await waitUntil({ timeoutInMilliseconds: timeout }); }, input: { timeoutInMilliseconds: 30000 } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a RENAMED destructured parameter, followed back through the call\'s own input'
    },
    {
      code: 'const SETTLE_IN_MILLISECONDS = 30000; evalInObsidian({ async callback({ lib: { waitUntil }, settleInMilliseconds }) { await waitUntil({ timeoutInMilliseconds: settleInMilliseconds }); }, input: { settleInMilliseconds: SETTLE_IN_MILLISECONDS } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a shorthand input property resolving on to a module const'
    },
    {
      code: 'evalInObsidian({ async callback({ notePath, timeoutInMilliseconds }) { await waitUntil({ timeoutInMilliseconds }); }, input: { notePath: "a.md", timeoutInMilliseconds: 30000 } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a pattern whose FIRST plain binding is not the budget, so the search has to walk past it'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ message: "a" }); await waitUntil({ message: "b" }); await sleep(20000); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'two omitted timeouts taking the 5000 default plus a settle sleep, which only cross the cap once the default is counted'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { const rest = {}; await waitUntil({ ...rest, timeoutInMilliseconds: 30000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a spread in the wait params, which is not a property and must be stepped over rather than crashed on'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { async function settle() { await waitUntil({ timeoutInMilliseconds: 30000 }); } await settle(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a wait inside a helper declared within the closure, which still runs inside the closure'
    },
    {
      code: 'evalInObsidian({ callback: async ({ lib: { waitUntil } }) => { await waitUntil({ timeoutInMilliseconds: 30000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'the arrow form of the callback, not only the method shorthand'
    },
    {
      code: 'pollInObsidian({ async poll({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30000 }); }, until: () => true });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a pollInObsidian poll closure, which is meant to be the SHORT one and is capped like any other'
    },
    {
      code: 'pollInObsidian({ poll: () => true, async start({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30000 }); }, until: () => true });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a pollInObsidian start closure'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 10000 }); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a wait under the default cap but at a tightened capInMilliseconds',
      options: [{ capInMilliseconds: 10_000 }]
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date.now() < deadline) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a Date deadline loop, whose whole budget is charged once however short its poll interval'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = performance.now() + 30000; while (performance.now() < deadline) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a performance deadline loop, the clock a Date-only reading left unbounded'
    },
    {
      code: 'evalInObsidian({ async callback({ app }) { const deadline = Date.now() + 30000; while (app.isBusy && Date.now() < deadline) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a deadline guard as one conjunct of a compound test, which is how every real one is written'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (deadline > Date.now()) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'the guard written the other way round, which is the same guard'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date.now() <= deadline) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a deadline guard written with <='
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (deadline >= Date.now()) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a reversed deadline guard written with >='
    },
    {
      code: 'evalInObsidian({ async callback({ waitInMilliseconds }) { const deadline = Date.now() + waitInMilliseconds; while (Date.now() < deadline) { await sleep(100); } }, input: { waitInMilliseconds: 30000 } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a deadline budget threaded through the call\'s own input, the dominant shape in the perf suites'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; do { await sleep(100); } while (Date.now() < deadline); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a do-while deadline loop'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; for (; Date.now() < deadline;) { await sleep(100); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a for loop guarded by a deadline rather than by a counter'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt < 40; attempt++) { await sleep(1000); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a counting for, whose waits run once per iteration and are charged that way'
    },
    {
      code: 'evalInObsidian({ async callback({ app }) { for (let attempt = 0; attempt < 6 && !app.isOpen; attempt++) { await sleep(5500); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a counting for whose test carries a progress condition beside its bound'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let elapsed = 0; elapsed < 30000; elapsed += 10000) { await sleep(10000); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a counting for advancing by more than one, which is three iterations rather than thirty thousand'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt <= 2; attempt++) { await sleep(10000); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a counting for bounded with <=, which runs one more time than the bound'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let outer = 0; outer < 2; outer++) { for (let inner = 0; inner < 3; inner++) { await sleep(6000); } } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'nested counting loops, whose counts multiply'
    },
    {
      code: 'const ATTEMPT_COUNT = 40; evalInObsidian({ async callback() { for (let attempt = 0; attempt < ATTEMPT_COUNT; attempt++) { await sleep(1000); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a counting for whose bound is a const in an outer scope, resolved by the same walk a budget is'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { for (let attempt = 0; attempt < 6; attempt++) { await waitUntil({ message: "a" }); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'an omitted timeout taking the helper default, multiplied by the loop that runs it'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { async function settle() { await waitUntil({ timeoutInMilliseconds: 10000 }); } await settle(); await settle(); await settle(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a helper called THREE times, whose waiting runs three times and is charged that way'
    },
    {
      code: 'evalInObsidian({ async callback() { const settle = async () => { await sleep(10000); }; await settle(); await settle(); await settle(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'an ARROW helper called three times, bound by a const rather than declared'
    },
    {
      code: 'evalInObsidian({ async callback() { async function settle() { await sleep(5000); } for (let attempt = 0; attempt < 6; attempt++) { await settle(); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a helper called inside a counting loop, so the call site carries the loop that runs it'
    },
    {
      code: 'evalInObsidian({ async callback() { async function waitForAsync() { for (let attempt = 0; attempt < 40; attempt++) { await sleep(250); } } await waitForAsync(); await waitForAsync(); await waitForAsync(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a bounded retry helper called three times, the exact shape a single attribution under-counted by two thirds'
    },
    {
      code: 'evalInObsidian({ async callback() { async function inner() { await sleep(5000); } async function outer() { await inner(); await inner(); } await outer(); await outer(); await outer(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a helper calling a helper, whose call counts multiply down the chain'
    },
    {
      code: 'evalInObsidian({ async callback() { async function retryAsync() { await sleep(30000); await retryAsync(); } await retryAsync(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'DIRECT recursion, which must terminate rather than charge itself forever'
    },
    {
      code: 'evalInObsidian({ async callback() { async function ping() { await sleep(20000); await pong(); } async function pong() { await sleep(10000); await ping(); } await ping(); } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'MUTUAL recursion, where re-entering a helper already being counted charges nothing'
    },
    {
      code: 'evalInObsidian({ async callback() { async function settle() { await sleep(30000); } } });',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a helper NO call site reaches, which keeps the flat single charge a lexical attribution gave it'
    }
  ],
  valid: [
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 20000 }); } });',
      name: 'a wait under the cap'
    },
    {
      code: 'async function run({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 60000 }); }',
      name: 'a wait that runs in no in-Obsidian closure at all, where the transport cap does not apply'
    },
    {
      code: 'pollInObsidian({ poll: () => true, until: () => { waitUntil({ timeoutInMilliseconds: 60000 }); return true; } });',
      name: 'a wait inside `until`, which is evaluated in NODE and is the whole point of converting'
    },
    {
      code: 'const run = async () => { await waitUntil({ timeoutInMilliseconds: 60000 }); };',
      name: 'a function expression that is not an object property at all, so there is no callback name to match'
    },
    {
      code: 'const { [() => { waitUntil({ timeoutInMilliseconds: 60000 }); }]: value } = source;',
      name: 'a function used as a computed key of a DESTRUCTURING property, whose parent is a pattern rather than an object literal'
    },
    {
      code: 'const options = { [() => { waitUntil({ timeoutInMilliseconds: 60000 }); }]: 1 };',
      name: 'a function used as a computed KEY of an object literal, which names no closure however the object is used'
    },
    {
      code: 'evalInObsidian({ async callback({ "timeoutInMilliseconds": timeout }) { await waitUntil({ timeoutInMilliseconds: timeout }); }, input: { timeoutInMilliseconds: 60000 } });',
      name: 'a string-literal destructuring key, which is not an identifier to look the input up by'
    },
    {
      code: 'evalInObsidian({ async callback({ ...rest }) { await waitUntil({ timeoutInMilliseconds: rest }); } });',
      name: 'a rest element in the closure\'s parameter pattern, which binds no single input key'
    },
    {
      code: 'somethingElse({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 60000 }); } });',
      name: 'a callback property of some other helper entirely'
    },
    {
      code: 'helpers.evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 60000 }); } });',
      name: 'a member call, which is not the imported helper this rule knows'
    },
    {
      code: 'evalInObsidian(transport, { async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 60000 }); } });',
      name: 'a params object that is not the FIRST argument, so it is not the helper\'s parameter object'
    },
    {
      code: 'const params = { async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 60000 }); } };',
      name: 'a plain object literal with a callback property that is never passed to the helper'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await lib.waitUntil({ timeoutInMilliseconds: 60000 }); } });',
      name: 'a member-call wait, which is not the seeded helper'
    },
    {
      code: 'evalInObsidian({ async callback() { await sleep(); } });',
      name: 'a sleep with no argument, which declares no budget'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { const params = { timeoutInMilliseconds: 60000 }; await waitUntil(params); } });',
      name: 'wait params held in a variable, where the declared budget is not readable from the call'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: "30000" }); } });',
      name: 'a non-numeric literal timeout'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: readTimeout() }); } });',
      name: 'a computed timeout, which stays silent rather than making every parameterized helper red'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: UNDECLARED_TIMEOUT }); } });',
      name: 'an identifier nothing in scope declares'
    },
    {
      code: 'function readTimeout() {} evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: readTimeout }); } });',
      name: 'an identifier bound to something that is not a variable declarator'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { let timeout; await waitUntil({ timeoutInMilliseconds: timeout }); } });',
      name: 'a declarator with no initializer'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { const TIMEOUT_IN_MILLISECONDS = TIMEOUT_IN_MILLISECONDS; await waitUntil({ timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS }); } });',
      name: 'a self-referencing binding, which must terminate rather than hang the linter'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30000 + 0 }); } });',
      name: 'a non-product binary expression, which is not worth an evaluator'
    },
    {
      code: 'evalInObsidian({ async callback({ lib: { waitUntil } }) { await waitUntil({ timeoutInMilliseconds: 30 * readTimeout() }); } });',
      name: 'a product with one unresolvable side'
    },
    {
      code: 'evalInObsidian({ async callback(args) { await waitUntil({ timeoutInMilliseconds: args }); } });',
      name: 'a POSITIONAL closure parameter, which is bound to no input key'
    },
    {
      code: 'const key = "timeoutInMilliseconds"; evalInObsidian({ async callback({ [key]: timeout }) { await waitUntil({ timeoutInMilliseconds: timeout }); }, input: { timeoutInMilliseconds: 60000 } });',
      name: 'a COMPUTED destructuring key, which names no input key statically'
    },
    {
      code: 'evalInObsidian({ async callback({ timeoutInMilliseconds }) { await waitUntil({ timeoutInMilliseconds }); } });',
      name: 'a destructured parameter on a call that passes no input at all'
    },
    {
      code: 'evalInObsidian({ async callback({ timeoutInMilliseconds }) { await waitUntil({ timeoutInMilliseconds }); }, input: sharedInput });',
      name: 'an input that is not an object literal, so the key cannot be read out of it'
    },
    {
      code: 'evalInObsidian({ async callback({ timeoutInMilliseconds }) { await waitUntil({ timeoutInMilliseconds }); }, input: { vaultPath: "x" } });',
      name: 'an input object that does not declare the key the closure destructured'
    },
    {
      code: 'evalInObsidian({ async callback() { while (true) { await sleep(20000); } } });',
      name: 'a genuinely unbounded loop, which keeps the per-iteration charge rather than a guess'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + readTimeout(); while (Date.now() < deadline) { await sleep(20000); } } });',
      name: 'a deadline whose budget does not resolve, which is silent like any unresolvable value'
    },
    {
      code: 'evalInObsidian({ async callback() { while (Date.now() < UNDECLARED_DEADLINE) { await sleep(20000); } } });',
      name: 'a deadline identifier nothing in scope declares'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = 5; while (Date.now() < deadline) { await sleep(20000); } } });',
      name: 'a deadline bound to a plain number rather than to a clock reading plus a budget'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() - 30000; while (Date.now() < deadline) { await sleep(20000); } } });',
      name: 'a binding that subtracts from the clock, which declares no ceiling'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = performance.now() + 30000; while (Date.now() < deadline) { await sleep(20000); } } });',
      name: 'a guard and a binding reading DIFFERENT clocks, whose comparison measures nothing'
    },
    {
      code: 'evalInObsidian({ async callback({ elapsed }) { const deadline = Date.now() + 30000; while (elapsed < deadline) { await sleep(20000); } } });',
      name: 'a guard comparing something that is not a clock reading at all'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date.now(0) < deadline) { await sleep(20000); } } });',
      name: 'a now call taking an argument, which is not the clock reading this rule knows'
    },
    {
      code: 'evalInObsidian({ async callback({ now }) { const deadline = Date.now() + 30000; while (now() < deadline) { await sleep(20000); } } });',
      name: 'a bare now call, whose callee names no clock object'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date["now"]() < deadline) { await sleep(20000); } } });',
      name: 'a computed member call, which names no clock method statically'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (globalThis.Date.now() < deadline) { await sleep(20000); } } });',
      name: 'a nested member call, whose object is not the bare clock identifier'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date.parse() < deadline) { await sleep(20000); } } });',
      name: 'a clock object\'s OTHER method, which is not a current-time reading'
    },
    {
      code: 'evalInObsidian({ async callback({ clock }) { const deadline = Date.now() + 30000; while (clock.now() < deadline) { await sleep(20000); } } });',
      name: 'a now call on something that is not one of the two clocks'
    },
    {
      code: 'evalInObsidian({ async callback() { const deadline = Date.now() + 30000; while (Date.now() !== deadline) { await sleep(20000); } } });',
      name: 'a comparison that is not an ordering, so it declares no ceiling'
    },
    {
      code: 'evalInObsidian({ async callback() { while (Date.now() < 30000) { await sleep(20000); } } });',
      name: 'a literal on the deadline side, which is a wall-clock instant rather than a budget'
    },
    {
      code: 'evalInObsidian({ async callback({ app }) { const deadline = Date.now() + 30000; while (app.isBusy || Date.now() < deadline) { await sleep(20000); } } });',
      name: 'an OR test, where the guard bounds nothing because the other side can keep the loop running'
    },
    {
      code: 'evalInObsidian({ async callback() { for (;;) { await sleep(20000); } } });',
      name: 'a for loop with no test at all, which declares neither a deadline nor a count'
    },
    {
      code: 'evalInObsidian({ async callback({ items }) { for (const item of items) { await sleep(20000); } } });',
      name: 'a for-of, whose length is not declared by the loop and which keeps the per-iteration charge'
    },
    {
      code: 'evalInObsidian({ async callback({ attempt }) { for (attempt = 0; attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a for whose init assigns rather than declares, so it names no counter to read'
    },
    {
      code: 'evalInObsidian({ async callback({ attempt }) { for (; attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a for with no init, whose counter has no readable starting value'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0, limit = 0; attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a for declaring two variables, where which one the test counts on is not this rule\'s to guess'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt; attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a for whose counter is declared without a starting value'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let [attempt] = [0]; attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a destructured counter, which is not a plain identifier to match the test against'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = readStart(); attempt < 40; attempt++) { await sleep(20000); } } });',
      name: 'a starting value that does not resolve'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt < 40;) { await sleep(20000); } } });',
      name: 'a for with no update, which advances by nothing this rule can read'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 40; attempt > 0; attempt--) { await sleep(20000); } } });',
      name: 'a countdown, whose update is not the advance this rule reads'
    },
    {
      code: 'evalInObsidian({ async callback({ other }) { for (let attempt = 0; attempt < 40; other++) { await sleep(20000); } } });',
      name: 'an update advancing some OTHER variable, so the counter never moves'
    },
    {
      code: 'evalInObsidian({ async callback({ counters }) { for (let attempt = 0; attempt < 40; counters[attempt]++) { await sleep(20000); } } });',
      name: 'an update advancing an element rather than the counter itself'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 1; attempt < 40; attempt *= 2) { await sleep(20000); } } });',
      name: 'a multiplying update, which is not a fixed step'
    },
    {
      code: 'evalInObsidian({ async callback({ other }) { for (let attempt = 0; attempt < 40; other += 1) { await sleep(20000); } } });',
      name: 'a step added to some OTHER variable'
    },
    {
      code: 'evalInObsidian({ async callback({ counters }) { for (let attempt = 0; attempt < 40; counters[attempt] += 1) { await sleep(20000); } } });',
      name: 'a step added to an element rather than to the counter'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt < 40; attempt += 0) { await sleep(20000); } } });',
      name: 'a step of zero, which never reaches the bound and so declares no count'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt !== 40; attempt++) { await sleep(20000); } } });',
      name: 'a test that is not an ordering, so the loop declares no count'
    },
    {
      code: 'evalInObsidian({ async callback({ limit }) { for (let attempt = 0; limit < 40; attempt++) { await sleep(20000); } } });',
      name: 'a test bounding something other than the counter the loop advances'
    },
    {
      code: 'evalInObsidian({ async callback({ counters }) { for (let attempt = 0; counters[attempt] < 40; attempt++) { await sleep(20000); } } });',
      name: 'a test whose left side is not an identifier at all'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt < readBound(); attempt++) { await sleep(20000); } } });',
      name: 'a bound that does not resolve'
    },
    {
      code: 'evalInObsidian({ async callback() { for (let attempt = 0; attempt < 0; attempt++) { await sleep(60000); } } });',
      name: 'a loop that cannot run at all, whose waits therefore cost nothing'
    },
    {
      code: 'evalInObsidian({ async callback({ app }) { const deadline = Date.now() + 10000; for (let attempt = 0; attempt < 100 && Date.now() < deadline; attempt++) { await sleep(500); } } });',
      name: 'a loop declaring BOTH a deadline and a count, where the deadline is the ceiling and the count must not multiply on top of it'
    },
    {
      code: 'const deadline = Date.now() + 60000; while (Date.now() < deadline) { await sleep(1000); }',
      name: 'a deadline loop in no in-Obsidian closure at all, where the transport cap does not apply'
    },
    {
      code: 'evalInObsidian({ async callback() { async function settle() { await sleep(10000); } await settle(); await settle(); } });',
      name: 'a helper called TWICE and staying under the cap, which is what makes the count a count rather than a flat charge'
    },
    {
      code: 'async function settle() { await sleep(60000); } evalInObsidian({ async callback() { await settle(); await settle(); } });',
      name: 'a helper declared OUTSIDE the closure, which would need analysis across call boundaries and stays silent'
    },
    {
      code: 'evalInObsidian({ async callback() { class Settle {} Settle(); await sleep(20000); } });',
      name: 'a callee bound by a class declaration, which declares no function to count'
    },
    {
      code: 'evalInObsidian({ async callback() { let settle; settle(); await sleep(20000); } });',
      name: 'a callee declared with no initializer'
    },
    {
      code: 'evalInObsidian({ async callback() { const settle = 5; settle(); await sleep(20000); } });',
      name: 'a callee bound to something that is not a function at all'
    }
  ]
});
