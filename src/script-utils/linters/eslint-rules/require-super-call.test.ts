import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it,
  vi
} from 'vitest';

import {
  MESSAGE_ID,
  requireSuperCall
} from './require-super-call.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

const TYPE_CHECK_TIMEOUT_IN_MILLISECONDS = 60_000;

vi.setConfig({ testTimeout: TYPE_CHECK_TIMEOUT_IN_MILLISECONDS });

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts']
      }
    }
  }
});

ruleTester.run('require-super-call', toRuleTesterModule(requireSuperCall), {
  invalid: [
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            console.log('no super');
          }
        }
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'override method without super call'
    },
    {
      code: `
        class Parent { async doWork(): Promise<void> {} }
        class Child extends Parent {
          public override async doWork(): Promise<void> {
            console.log('working');
          }
        }
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'async override method without super call'
    },
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            super.otherMethod();
          }
        }
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'override calls super but wrong method name'
    },
    {
      code: `
        class Parent { a(): void {} b(): void {} }
        class Child extends Parent {
          public override a(): void {
            console.log('a');
          }
          public override b(): void {
            console.log('b');
          }
        }
      `,
      errors: [
        { messageId: MESSAGE_ID },
        { messageId: MESSAGE_ID }
      ],
      name: 'multiple override methods without super calls'
    },
    {
      code: `
        class Parent { hook(): boolean { return true; } }
        class Child extends Parent {
          public override hook(): boolean {
            return false;
          }
        }
      `,
      errors: [{ messageId: MESSAGE_ID }],
      name: 'override of parent returning literal without super call'
    }
  ],
  valid: [
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            super.method();
            console.log('extra');
          }
        }
      `,
      name: 'override with super call at start'
    },
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            console.log('before');
            super.method();
          }
        }
      `,
      name: 'override with super call at end'
    },
    {
      code: `
        class Parent { async doWork(): Promise<void> {} }
        class Child extends Parent {
          public override async doWork(): Promise<void> {
            await super.doWork();
            console.log('done');
          }
        }
      `,
      name: 'async override with awaited super call'
    },
    {
      code: `
        class Parent { compute(): number { return 0; } }
        class Child extends Parent {
          public override compute(): number {
            const result = super.compute();
            return result + 10;
          }
        }
      `,
      name: 'override with super call assigned to variable'
    },
    {
      code: `
        class Parent { compute(): number { return 0; } }
        class Child extends Parent {
          public override compute(): number {
            return super.compute() + 10;
          }
        }
      `,
      name: 'override with super call in return expression'
    },
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            if (Math.random() > 0.5) {
              super.method();
            }
          }
        }
      `,
      name: 'override with super call inside if block'
    },
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public override method(): void {
            try {
              super.method();
            } catch {}
          }
        }
      `,
      name: 'override with super call inside try block'
    },
    {
      code: `
        class Parent { method(arg: string): void {} }
        class Child extends Parent {
          public override method(arg: string): void {
            super.method(arg);
          }
        }
      `,
      name: 'override with super call passing arguments'
    },
    {
      code: `
        class MyClass {
          public method(): void {
            console.log('not an override');
          }
        }
      `,
      name: 'non-override method without super (no error)'
    },
    {
      code: `
        class Parent { method(): void {} }
        class Child extends Parent {
          public newMethod(): void {
            console.log('new');
          }
        }
      `,
      name: 'non-override method on class that extends (no error)'
    },
    {
      code: `
        abstract class Parent { abstract method(): void; }
        class Child extends Parent {
          public override method(): void {
            console.log('implementing abstract');
          }
        }
      `,
      name: 'implementing abstract method (no super to call)'
    },
    {
      code: `
        abstract class Parent { abstract compute(): number; }
        class Child extends Parent {
          public override compute(): number {
            return 42;
          }
        }
      `,
      name: 'implementing abstract method with return value'
    },
    {
      code: `
        abstract class Base { abstract init(): void; }
        class Middle extends Base { override init(): void { console.log('middle'); } }
        class Leaf extends Middle {
          public override init(): void {
            super.init();
          }
        }
      `,
      name: 'override of concrete method in chain with abstract grandparent'
    }
  ]
});
