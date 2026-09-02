import {
  describe,
  expect,
  it
} from 'vitest';

import {
  findIncompleteFacades,
  findModuleSupersessions,
  formatIncompleteFacades,
  toSupersededModules
} from './module-supersession.ts';

describe('findModuleSupersessions', () => {
  it('supersedes both platform twins of a same-named facade', () => {
    expect(findModuleSupersessions([
      './obsidian/desktop-trusted-input.ts',
      './obsidian/mobile-trusted-input.ts',
      './obsidian/trusted-input.ts'
    ])).toEqual([{
      facade: './obsidian/trusted-input.ts',
      superseded: [
        './obsidian/desktop-trusted-input.ts',
        './obsidian/mobile-trusted-input.ts'
      ]
    }]);
  });

  it('supersedes a lone twin when only one platform has an arm', () => {
    expect(findModuleSupersessions([
      './obsidian/desktop-trusted-input.ts',
      './obsidian/trusted-input.ts'
    ])).toEqual([{
      facade: './obsidian/trusted-input.ts',
      superseded: ['./obsidian/desktop-trusted-input.ts']
    }]);
  });

  it('leaves an unpaired platform module alone', () => {
    // `desktop-demo-vault-opener.ts` has no facade, so its `openDemoVault` must still reach the barrel.
    expect(findModuleSupersessions([
      './obsidian/demo-vault-helper.ts',
      './obsidian/desktop-demo-vault-opener.ts'
    ])).toEqual([]);
  });

  it('matches only within a directory', () => {
    expect(findModuleSupersessions([
      './obsidian/desktop-trusted-input.ts',
      './trusted-input.ts'
    ])).toEqual([]);
  });

  it('ignores an unprefixed module whose name merely contains a prefix', () => {
    expect(findModuleSupersessions([
      './obsidian/not-desktop-trusted-input.ts',
      './obsidian/trusted-input.ts'
    ])).toEqual([]);
  });

  it('reports facades sorted by specifier', () => {
    expect(
      findModuleSupersessions([
        './obsidian/mobile-b.ts',
        './obsidian/b.ts',
        './obsidian/desktop-a.ts',
        './obsidian/a.ts'
      ]).map((supersession) => supersession.facade)
    ).toEqual([
      './obsidian/a.ts',
      './obsidian/b.ts'
    ]);
  });
});

describe('findIncompleteFacades', () => {
  const supersessions = [{
    facade: './obsidian/trusted-input.ts',
    superseded: [
      './obsidian/desktop-trusted-input.ts',
      './obsidian/mobile-trusted-input.ts'
    ]
  }];

  it('accepts a facade that re-exports every value name of its twins', () => {
    expect(findIncompleteFacades(
      supersessions,
      new Map([
        ['./obsidian/desktop-trusted-input.ts', ['clickElement', 'pressKey']],
        ['./obsidian/mobile-trusted-input.ts', ['clickElement', 'pressKey']],
        ['./obsidian/trusted-input.ts', ['clickElement', 'pressKey']]
      ])
    )).toEqual([]);
  });

  it('accepts a facade that exports more than its twins do', () => {
    expect(findIncompleteFacades(
      supersessions,
      new Map([
        ['./obsidian/desktop-trusted-input.ts', ['pressKey']],
        ['./obsidian/mobile-trusted-input.ts', ['pressKey']],
        ['./obsidian/trusted-input.ts', ['isTrustedInputAvailable', 'pressKey']]
      ])
    )).toEqual([]);
  });

  it('reports the names a twin has and the facade does not', () => {
    expect(findIncompleteFacades(
      supersessions,
      new Map([
        ['./obsidian/desktop-trusted-input.ts', ['pressKey', 'scrollBy', 'moveMouse']],
        ['./obsidian/mobile-trusted-input.ts', ['pressKey']],
        ['./obsidian/trusted-input.ts', ['pressKey']]
      ])
    )).toEqual([{
      facade: './obsidian/trusted-input.ts',
      missingNames: ['moveMouse', 'scrollBy'],
      supersededModule: './obsidian/desktop-trusted-input.ts'
    }]);
  });

  it('reports a facade that exports nothing at all', () => {
    expect(findIncompleteFacades(
      supersessions,
      new Map([
        ['./obsidian/desktop-trusted-input.ts', ['pressKey']],
        ['./obsidian/mobile-trusted-input.ts', ['pressKey']]
      ])
    )).toEqual([
      {
        facade: './obsidian/trusted-input.ts',
        missingNames: ['pressKey'],
        supersededModule: './obsidian/desktop-trusted-input.ts'
      },
      {
        facade: './obsidian/trusted-input.ts',
        missingNames: ['pressKey'],
        supersededModule: './obsidian/mobile-trusted-input.ts'
      }
    ]);
  });
});

describe('formatIncompleteFacades', () => {
  it('renders one line per incomplete pair', () => {
    expect(formatIncompleteFacades([{
      facade: './obsidian/trusted-input.ts',
      missingNames: ['moveMouse', 'scrollBy'],
      supersededModule: './obsidian/desktop-trusted-input.ts'
    }])).toBe('  ./obsidian/trusted-input.ts does not re-export moveMouse, scrollBy from ./obsidian/desktop-trusted-input.ts');
  });
});

describe('toSupersededModules', () => {
  it('flattens every superseded module into one set', () => {
    expect([...toSupersededModules([
      {
        facade: './obsidian/trusted-input.ts',
        superseded: [
          './obsidian/desktop-trusted-input.ts',
          './obsidian/mobile-trusted-input.ts'
        ]
      },
      { facade: './a.ts', superseded: ['./desktop-a.ts'] }
    ])]).toEqual([
      './obsidian/desktop-trusted-input.ts',
      './obsidian/mobile-trusted-input.ts',
      './desktop-a.ts'
    ]);
  });
});
