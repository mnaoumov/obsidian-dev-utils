import type { Element } from 'hast';

import {
  describe,
  expect,
  it
} from 'vitest';

import { decorateHast } from './util.ts';

describe('decorateHast', () => {
  it('mirrors tagName/properties into data for remark-directive and recurses into element children', () => {
    const grandchild: Element = { children: [{ type: 'text', value: 'hi' }], properties: { className: ['leaf'] }, tagName: 'em', type: 'element' };
    const child: Element = { children: [grandchild], properties: {}, tagName: 'span', type: 'element' };
    const root: Element = {
      children: [child, { type: 'text', value: 'ignored' }],
      properties: { id: 'root' },
      tagName: 'div',
      type: 'element'
    };

    decorateHast(root);

    expect(root.data).toMatchObject({ hName: 'div', hProperties: { id: 'root' } });
    expect(child.data).toMatchObject({ hName: 'span', hProperties: {} });
    expect(grandchild.data).toMatchObject({ hName: 'em', hProperties: { className: ['leaf'] } });
  });

  it('leaves non-element (text) children untouched', () => {
    const text = { type: 'text', value: 'plain' } as const;
    const root: Element = { children: [text], properties: {}, tagName: 'p', type: 'element' };

    decorateHast(root);

    expect(text).toEqual({ type: 'text', value: 'plain' });
  });
});
