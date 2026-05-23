import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  it
} from 'vitest';

import {
  MESSAGE_ID_MISSING_TEMPLATE,
  MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION,
  requireMethodTemplate
} from './require-method-template.ts';
import { toRuleTesterModule } from './rule-tester-helper.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  settings: {
    jsdoc: {
      tagNamePreference: {
        template: 'typeParam'
      }
    }
  }
});

ruleTester.run('require-method-template', toRuleTesterModule(requireMethodTemplate), {
  invalid: [
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @param name - The name.
   */
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_TEMPLATE }],
      name: 'generic method missing @typeParam'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @typeParam T - The type.
   * @param name - The name.
   */
  public bar<T, U>(name: T): U {
    return name as unknown as U;
  }
}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_TEMPLATE }],
      name: 'generic method missing one of two @typeParam'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @typeParam T
   * @param name - The name.
   */
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION }],
      name: '@typeParam without description'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @typeParam T -
   * @param name - The name.
   */
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_TEMPLATE_DESCRIPTION }],
      name: '@typeParam with only dash and no description'
    }
  ],
  valid: [
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @typeParam T - The type.
   * @param name - The name.
   */
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      name: 'generic method with @typeParam and description'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @param name - The name.
   */
  public bar(name: string): string {
    return name;
  }
}
      `,
      name: 'non-generic method (no type params)'
    },
    {
      code: `
class Foo {
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      name: 'generic method with no JSDoc at all (not our concern)'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @template T - The type.
   * @param name - The name.
   */
  public bar<T>(name: T): T {
    return name;
  }
}
      `,
      name: '@template tag also accepted'
    },
    {
      code: `
class Foo {
  /**
   * Does something.
   *
   * @typeParam T - First type.
   * @typeParam U - Second type.
   * @param name - The name.
   */
  public bar<T, U>(name: T): U {
    return name as unknown as U;
  }
}
      `,
      name: 'multiple @typeParam tags all present with descriptions'
    }
  ]
});
