import {
  describe,
  expect,
  it
} from 'vitest';

import {
  findExportNameCollisions,
  formatExportNameCollisions
} from './export-name-collisions.ts';

describe('findExportNameCollisions', () => {
  it('flags exports in one namespace that differ only by case', () => {
    expect(findExportNameCollisions(new Map([
      ['./type.ts', ['StringKeys', 'TypeAsserter', 'typeAsserter']]
    ]))).toEqual([{ names: ['TypeAsserter', 'typeAsserter'], namespace: './type.ts' }]);
  });

  it('allows case-distinct names across different namespaces', () => {
    expect(findExportNameCollisions(new Map([
      ['./a.ts', ['Foo']],
      ['./b.ts', ['foo']]
    ]))).toEqual([]);
  });

  it('ignores exact-duplicate names (declaration merging) and unique names', () => {
    expect(findExportNameCollisions(new Map([
      ['./a.ts', ['Foo', 'Foo', 'Bar', 'baz']]
    ]))).toEqual([]);
  });

  it('reports every colliding group in a namespace', () => {
    expect(findExportNameCollisions(new Map([
      ['./m.ts', ['Alpha', 'alpha', 'Beta', 'BETA', 'Gamma']]
    ]))).toEqual([
      { names: ['Alpha', 'alpha'], namespace: './m.ts' },
      { names: ['BETA', 'Beta'], namespace: './m.ts' }
    ]);
  });
});

describe('formatExportNameCollisions', () => {
  it('renders one line per colliding group', () => {
    expect(formatExportNameCollisions([
      { names: ['TypeAsserter', 'typeAsserter'], namespace: './type.ts' },
      { names: ['Foo', 'foo'], namespace: './bar.ts' }
    ])).toBe('  ./type.ts: TypeAsserter vs typeAsserter\n  ./bar.ts: Foo vs foo');
  });
});
