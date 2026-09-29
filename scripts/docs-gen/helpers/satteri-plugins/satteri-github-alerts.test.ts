import type {
  Blockquote,
  Parents,
  PhrasingContent
} from 'mdast';
import type { MdastVisitorContext } from 'satteri';

import {
  describe,
  expect,
  it
} from 'vitest';

import { castTo } from '../../../../src/object-utils.ts';
import { satteriGitHubAlerts } from './satteri-github-alerts.ts';

describe('satteriGitHubAlerts', () => {
  it.each([
    ['NOTE', 'note'],
    ['TIP', 'tip'],
    ['IMPORTANT', 'caution'],
    ['WARNING', 'caution'],
    ['CAUTION', 'danger'],
    ['warning', 'caution']
  ])('turns a [!%s] alert into a %s aside and strips its marker', async (type, variant) => {
    const node = blockquote([text(`[!${type}]\nBody text`)]);
    const context = mockContext();

    await visit(node, context);

    expect(context.properties).toEqual([{ key: 'value', value: 'Body text' }]);
    expect(context.replacements).toEqual([{
      children: node.children,
      name: variant,
      type: 'containerDirective'
    }]);
  });

  it('leaves a blockquote alone when it is not an alert', async () => {
    const context = mockContext();

    await visit(blockquote([text('Just a quote')]), context);
    await visit(blockquote([text('[!BOGUS] not a GitHub type')]), context);
    await visit(blockquote([{ children: [text('[!NOTE]')], type: 'emphasis' }]), context);
    await visit(blockquote([]), context);
    await visit({ children: [{ lang: null, meta: null, type: 'code', value: '[!NOTE]' }], type: 'blockquote' }, context);

    expect(context.replacements).toEqual([]);
    expect(context.properties).toEqual([]);
  });

  it('leaves an alert nested inside another alert as a blockquote, as GitHub does', async () => {
    const outer = blockquote([text('[!NOTE]')]);
    const plainQuote = blockquote([text('Just a quote')]);
    const inner = blockquote([text('[!TIP] inner')]);
    const parents = new Map<unknown, Parents>([[inner, plainQuote], [plainQuote, outer]]);
    const context = mockContext(parents);

    await visit(inner, context);

    expect(context.replacements).toEqual([]);
  });

  it('converts an alert nested in a plain blockquote', async () => {
    const plainQuote = blockquote([text('Just a quote')]);
    const inner = blockquote([text('[!TIP] inner')]);
    const context = mockContext(new Map<unknown, Parents>([[inner, plainQuote]]));

    await visit(inner, context);

    expect(context.replacements).toHaveLength(1);
  });
});

interface MockContext {
  properties: RecordedProperty[];
  replacements: unknown[];
  value: MdastVisitorContext;
}

interface RecordedProperty {
  key: string;
  value: unknown;
}

function blockquote(children: PhrasingContent[]): Blockquote {
  return {
    children: children.length === 0 ? [] : [{ children, type: 'paragraph' }],
    type: 'blockquote'
  };
}

function mockContext(parents = new Map<unknown, Parents>()): MockContext {
  const properties: RecordedProperty[] = [];
  const replacements: unknown[] = [];
  const value = castTo<MdastVisitorContext>({
    parent: (node: unknown): Parents | undefined => parents.get(node),
    replaceNode: (_node: unknown, newNode: unknown): void => {
      replacements.push(newNode);
    },
    setProperty: (_node: unknown, key: string, propertyValue: unknown): void => {
      properties.push({ key, value: propertyValue });
    }
  });

  return {
    properties,
    replacements,
    value
  };
}

function text(value: string): PhrasingContent {
  return { type: 'text', value };
}

async function visit(node: Blockquote, context: MockContext): Promise<void> {
  await satteriGitHubAlerts().blockquote?.(node, context.value);
}
