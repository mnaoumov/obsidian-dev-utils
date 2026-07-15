import type { Root } from 'mdast';
import type { VFile } from 'vfile';

import {
  describe,
  expect,
  it
} from 'vitest';

import { remarkRelativeLinks } from './remark-relative-links.ts';

describe('remarkRelativeLinks', () => {
  it('rewrites based internal links relative to the current content page', () => {
    const tree: Root = {
      children: [{
        children: [{ type: 'text', value: 'Alpha' }],
        type: 'link',
        url: '/obsidian-dev-utils/api/alpha/Alpha/#member'
      }],
      type: 'root'
    };
    const transformer = remarkRelativeLinks('/obsidian-dev-utils')();

    transformer(tree, { history: ['F:/repo/docs/src/content/docs/api/bravo/Bravo/index.mdx'] } as VFile);

    expect(getFirstLinkUrl(tree)).toBe('../../alpha/Alpha/#member');
  });

  it('rewrites a self-link to the current directory instead of emitting a 404-ing double slash', () => {
    const tree: Root = {
      children: [
        { children: [{ type: 'text', value: 'this' }], type: 'link', url: '/obsidian-dev-utils/api/path/join/' },
        { children: [{ type: 'text', value: 'section' }], type: 'link', url: '/obsidian-dev-utils/api/path/join/#overloads' }
      ],
      type: 'root'
    };
    const transformer = remarkRelativeLinks('/obsidian-dev-utils')();

    transformer(tree, { history: ['F:/repo/docs/src/content/docs/api/path/join/index.mdx'] } as VFile);

    expect(getLinkUrls(tree)).toEqual(['./', '#overloads']);
  });

  it('leaves external and unlocated links unchanged', () => {
    const tree: Root = {
      children: [{ children: [], type: 'link', url: 'https://example.com' }],
      type: 'root'
    };
    const transformer = remarkRelativeLinks('/obsidian-dev-utils')();

    transformer(tree, { history: [] } as VFile);

    expect(getFirstLinkUrl(tree)).toBe('https://example.com');
  });
});

function getFirstLinkUrl(tree: Root): string {
  const node = tree.children[0];
  if (node?.type !== 'link') {
    throw new Error('Expected the first node to be a link.');
  }
  return node.url;
}

function getLinkUrls(tree: Root): string[] {
  return tree.children.map((node) => {
    if (node.type !== 'link') {
      throw new Error('Expected every node to be a link.');
    }
    return node.url;
  });
}
