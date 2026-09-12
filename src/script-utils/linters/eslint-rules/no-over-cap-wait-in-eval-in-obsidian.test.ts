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
    }
  ]
});
