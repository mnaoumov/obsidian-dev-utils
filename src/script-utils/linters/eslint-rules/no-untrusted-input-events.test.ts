import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID,
  noUntrustedInputEvents
} from './no-untrusted-input-events.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run('no-untrusted-input-events', toRuleTesterModule(noUntrustedInputEvents), {
  invalid: [
    {
      code: 'el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched KeyboardEvent'
    },
    {
      code: 'el.dispatchEvent(new MouseEvent("click", { bubbles: true }));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched MouseEvent'
    },
    {
      code: 'el.dispatchEvent(new PointerEvent("pointerdown"));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched PointerEvent'
    },
    {
      code: 'el.dispatchEvent(new DragEvent("dragstart"));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched DragEvent, which has no trusted equivalent but still has to be justified'
    },
    {
      code: 'el.dispatchEvent(new TouchEvent("touchstart"));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched TouchEvent'
    },
    {
      code: 'el.dispatchEvent(new WheelEvent("wheel"));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatched WheelEvent'
    },
    {
      code: 'const dragOver = new DragEvent("dragover"); target.dispatchEvent(dragOver);',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'an event held in a variable, which is how a drag sequence sharing one DataTransfer is written'
    },
    {
      code: 'const clickEvent = new MouseEvent("click"); function run() { el.dispatchEvent(clickEvent); }',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'an event declared in an OUTER scope, so the lookup has to walk upwards'
    },
    {
      code: 'this.containerEl.dispatchEvent(new MouseEvent("contextmenu"));',
      errors: [{ messageId: MESSAGE_ID }],
      name: 'a dispatch on a member expression receiver'
    }
  ],
  valid: [
    {
      code: 'el.dispatchEvent(new Event("input", { bubbles: true }));',
      name: 'a notification Event after setting .value, which nothing gates on isTrusted'
    },
    {
      code: 'el.dispatchEvent(new InputEvent("input"));',
      name: 'a notification InputEvent, for the same reason'
    },
    {
      code: 'el.dispatchEvent(new CustomEvent("my-event"));',
      name: 'a CustomEvent, which simulates no user input at all'
    },
    {
      code: 'pressKey({ key: "Enter" });',
      name: 'the trusted helper this rule exists to steer towards'
    },
    {
      code: 'dispatchEvent(new MouseEvent("click"));',
      name: 'a bare dispatchEvent call with no receiver, which is not the pattern under test'
    },
    {
      code: 'el.addEventListener("click", handler);',
      name: 'a different method on an element'
    },
    {
      code: 'el["dispatchEvent"](new MouseEvent("click"));',
      name: 'a computed member access, where the property is not an identifier'
    },
    {
      code: 'el.dispatchEvent();',
      name: 'dispatchEvent with no arguments at all'
    },
    {
      code: 'el.dispatchEvent(new window.MouseEvent("click"));',
      name: 'a namespaced constructor, whose callee is not a bare identifier'
    },
    {
      code: 'el.dispatchEvent(buildEvent());',
      name: 'an argument that is neither a construction nor an identifier'
    },
    {
      code: 'el.dispatchEvent(undeclaredEvent);',
      name: 'an identifier nothing in scope declares'
    },
    {
      code: 'const notAnEvent = 42; el.dispatchEvent(notAnEvent);',
      name: 'an identifier whose initializer is not a construction'
    },
    {
      code: 'let pending; el.dispatchEvent(pending);',
      name: 'an identifier declared without an initializer'
    },
    {
      code: 'const wrapped = new Event("input"); el.dispatchEvent(wrapped);',
      name: 'a notification event held in a variable'
    },
    {
      code: 'function outer(payload) { el.dispatchEvent(payload); }',
      name: 'a parameter, whose definition is not a variable declarator'
    }
  ]
});
