import type { Rule } from 'eslint';

import { RuleTester } from '@typescript-eslint/rule-tester';
import {
  afterAll,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { strictProxy } from '../../../strict-proxy.ts';
import { assertNonNullable } from '../../../type-guards.ts';
import {
  MESSAGE_ID_ABSTRACT_NEEDS_BASE,
  MESSAGE_ID_BASE_NOT_ABSTRACT,
  MESSAGE_ID_MISSING_SUFFIX,
  requireComponentSuffix
} from './require-component-suffix.ts';
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

interface MockBaseType {
  getBaseTypes?(): MockBaseType[] | undefined;
  getSymbol?(): MockSymbol | undefined;
}

interface MockRuleContextResult {
  report: ReturnType<typeof vi.fn>;
  visitors: Record<string, (node: Rule.Node) => void>;
}

interface MockSymbol {
  getName(): string;
}

/**
 * Creates a mock ESLint context for testing the rule's behavior
 * when the TypeScript type checker returns various type structures.
 *
 * @param classType - The mock class type to return from the type checker.
 * @returns The mock context and visitor functions.
 */
function createMockRuleContext(classType: MockBaseType): MockRuleContextResult {
  const report = vi.fn();

  const context = strictProxy<Rule.RuleContext>({
    report,
    sourceCode: strictProxy<Rule.RuleContext['sourceCode']>({
      parserServices: {
        esTreeNodeToTSNodeMap: new Map(),
        program: {
          getTypeChecker: () =>
            strictProxy({
              getTypeAtLocation: () => classType
            })
        }
      }
    })
  });

  const visitors = requireComponentSuffix.create(context) as Record<string, (node: Rule.Node) => void>;

  return { report, visitors };
}

describe('require-component-suffix (unresolvable types)', () => {
  it('should not report when getBaseTypes() returns undefined', () => {
    const classType: MockBaseType = {
      getBaseTypes: (): undefined => undefined
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'Foo' } };
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).not.toHaveBeenCalled();
  });

  it('should not report when getSymbol() returns undefined for ancestor', () => {
    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [{
        getSymbol: (): undefined => undefined
      }]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'Foo' } };
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).not.toHaveBeenCalled();
  });

  it('should report when ancestor chain includes Component but class lacks suffix', () => {
    const componentType: MockBaseType = {
      getBaseTypes: (): undefined => undefined,
      getSymbol: (): MockSymbol => ({ getName: () => 'Component' })
    };

    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [componentType]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'Foo' } };
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: MESSAGE_ID_MISSING_SUFFIX }));
  });

  it.each([
    'HoverPopover',
    'MarkdownRenderChild',
    'Menu',
    'Plugin',
    'QueryController',
    'View'
  ])('should not report when ancestor chain includes %s', (excludedAncestor) => {
    const componentType: MockBaseType = {
      getBaseTypes: (): undefined => undefined,
      getSymbol: (): MockSymbol => ({ getName: () => 'Component' })
    };

    const excludedType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [componentType],
      getSymbol: (): MockSymbol => ({ getName: () => excludedAncestor })
    };

    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [excludedType]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: `My${excludedAncestor}` } };
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).not.toHaveBeenCalled();
  });

  it('should report abstract class ending with Component instead of ComponentBase', () => {
    const componentType: MockBaseType = {
      getBaseTypes: (): undefined => undefined,
      getSymbol: (): MockSymbol => ({ getName: () => 'Component' })
    };

    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [componentType]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'FooComponent' } } as Rule.Node;
    Object.assign(classNode, { abstract: true });
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: MESSAGE_ID_ABSTRACT_NEEDS_BASE }));
  });

  it('should report non-abstract class ending with ComponentBase', () => {
    const componentType: MockBaseType = {
      getBaseTypes: (): undefined => undefined,
      getSymbol: (): MockSymbol => ({ getName: () => 'Component' })
    };

    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [componentType]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'FooComponentBase' } };
    const visitor = visitors['ClassDeclaration[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: MESSAGE_ID_BASE_NOT_ABSTRACT }));
  });
});

describe('require-component-suffix (ClassExpression path)', () => {
  it('should check named class expressions via ClassExpression[id] visitor', () => {
    const componentType: MockBaseType = {
      getBaseTypes: (): undefined => undefined,
      getSymbol: (): MockSymbol => ({ getName: () => 'Component' })
    };

    const classType: MockBaseType = {
      getBaseTypes: (): MockBaseType[] => [componentType]
    };

    const { report, visitors } = createMockRuleContext(classType);
    const classNode = { id: { name: 'BadName' } };
    const visitor = visitors['ClassExpression[id]'];
    assertNonNullable(visitor);
    visitor(classNode as Rule.Node);

    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: MESSAGE_ID_MISSING_SUFFIX }));
  });
});

ruleTester.run('require-component-suffix', toRuleTesterModule(requireComponentSuffix), {
  invalid: [
    {
      code: `
        import { Component } from 'obsidian';
        class Foo extends Component {}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_SUFFIX }],
      name: 'direct Component subclass without suffix'
    },
    {
      code: `
        import { Component } from 'obsidian';
        class FooComponent extends Component {}
        class Bar extends FooComponent {}
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_SUFFIX }],
      name: 'transitive Component subclass without suffix'
    },
    {
      code: `
        import { Component } from 'obsidian';
        class MyWidget extends Component {
          onload(): void {}
        }
      `,
      errors: [{ messageId: MESSAGE_ID_MISSING_SUFFIX }],
      name: 'Component subclass with non-Component name'
    },
    {
      code: `
        import { Component } from 'obsidian';
        abstract class FooComponent extends Component {}
      `,
      errors: [{ messageId: MESSAGE_ID_ABSTRACT_NEEDS_BASE }],
      name: 'abstract class ending with Component instead of ComponentBase'
    },
    {
      code: `
        import { Component } from 'obsidian';
        class FooComponentBase extends Component {}
      `,
      errors: [{ messageId: MESSAGE_ID_BASE_NOT_ABSTRACT }],
      name: 'non-abstract class ending with ComponentBase'
    },
    {
      code: `
        import { Component } from 'obsidian';
        abstract class Foo extends Component {}
      `,
      errors: [{ messageId: MESSAGE_ID_ABSTRACT_NEEDS_BASE }],
      name: 'abstract class without any Component suffix'
    }
  ],
  valid: [
    {
      code: `
        import { Component } from 'obsidian';
        class FooComponent extends Component {}
      `,
      name: 'non-abstract class with Component suffix'
    },
    {
      code: `
        import { Component } from 'obsidian';
        class FooComponent extends Component {}
        class BarComponent extends FooComponent {}
      `,
      name: 'transitive Component subclass with Component suffix'
    },
    {
      code: `
        import { Component } from 'obsidian';
        abstract class FooComponentBase extends Component {}
      `,
      name: 'abstract class with ComponentBase suffix'
    },
    {
      code: `
        import { Component } from 'obsidian';
        abstract class FooComponentBase extends Component {}
        class FooComponent extends FooComponentBase {}
      `,
      name: 'abstract ComponentBase with concrete Component subclass'
    },
    {
      code: `
        import { Plugin } from 'obsidian';
        class MyPlugin extends Plugin {}
      `,
      name: 'Plugin subclass is excluded'
    },
    {
      code: `
        import { Plugin } from 'obsidian';
        class MyPluginBase extends Plugin {}
        class MySpecialPlugin extends MyPluginBase {}
      `,
      name: 'transitive Plugin subclass is excluded'
    },
    {
      code: `
        import { View } from 'obsidian';
        class MyView extends View {
          getViewType(): string { return 'my-view'; }
          getDisplayText(): string { return 'My View'; }
        }
      `,
      name: 'View subclass is excluded'
    },
    {
      code: `
        import { ItemView } from 'obsidian';
        class MyItemView extends ItemView {
          getViewType(): string { return 'my-view'; }
          getDisplayText(): string { return 'My View'; }
        }
      `,
      name: 'transitive View subclass (ItemView) is excluded'
    },
    {
      code: `
        import { MarkdownRenderChild } from 'obsidian';
        class MyRenderChild extends MarkdownRenderChild {}
      `,
      name: 'MarkdownRenderChild subclass is excluded'
    },
    {
      code: `
        import { Menu } from 'obsidian';
        class MyMenu extends Menu {}
      `,
      name: 'Menu subclass is excluded'
    },
    {
      code: `
        import { HoverPopover } from 'obsidian';
        class MyPopover extends HoverPopover {}
      `,
      name: 'HoverPopover subclass is excluded'
    },
    {
      code: `
        class Foo {}
      `,
      name: 'class not extending Component (no error)'
    },
    {
      code: `
        class Foo extends Array {}
      `,
      name: 'class extending non-Component (no error)'
    }
  ]
});
