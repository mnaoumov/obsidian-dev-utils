// @vitest-environment jsdom

import type { MockInstance } from 'vitest';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../object-utils.ts';
import {
  clickElement,
  clickMouse,
  hoverElement,
  moveMouse,
  pressKey,
  typeIntoEditor,
  unhoverElement
} from './trusted-input.ts';

type Arm = Record<HelperName, MockInstance>;

interface HelperCase {
  /**
   * Calls the facade's helper with the sentinel params, so the test never has to build a real
   * `HTMLElement` or `Editor` just to watch it be forwarded to an arm.
   */
  call(params: object): Promise<void>;

  /**
   * The name both arms export it under.
   */
  name: HelperName;
}

type HelperName =
  | 'clickElement'
  | 'clickMouse'
  | 'hoverElement'
  | 'moveMouse'
  | 'pressKey'
  | 'typeIntoEditor'
  | 'unhoverElement';

const HELPER_NAMES: HelperName[] = [
  'clickElement',
  'clickMouse',
  'hoverElement',
  'moveMouse',
  'pressKey',
  'typeIntoEditor',
  'unhoverElement'
];

const { desktopArm, mobileArm, platformState } = vi.hoisted(() => {
  const helperNames = [
    'clickElement',
    'clickMouse',
    'hoverElement',
    'moveMouse',
    'pressKey',
    'typeIntoEditor',
    'unhoverElement'
  ];

  function createArm(): Record<string, unknown> {
    return Object.fromEntries(helperNames.map((helperName) => [helperName, vi.fn().mockResolvedValue(undefined)]));
  }

  return {
    desktopArm: createArm(),
    mobileArm: createArm(),
    platformState: { isDesktopApp: true }
  };
});

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return {
    ...actual,
    Platform: {
      ...actual.Platform,
      get isDesktopApp(): boolean {
        return platformState.isDesktopApp;
      }
    }
  };
});

vi.mock('./desktop-trusted-input.ts', () => desktopArm);
vi.mock('./mobile-trusted-input.ts', () => mobileArm);

const HELPER_CASES: HelperCase[] = [
  {
    call: async (params): Promise<void> => {
      await clickElement(castTo(params));
    },
    name: 'clickElement'
  },
  {
    call: async (params): Promise<void> => {
      await clickMouse(castTo(params));
    },
    name: 'clickMouse'
  },
  {
    call: async (params): Promise<void> => {
      await hoverElement(castTo(params));
    },
    name: 'hoverElement'
  },
  {
    call: async (params): Promise<void> => {
      await moveMouse(castTo(params));
    },
    name: 'moveMouse'
  },
  {
    call: async (params): Promise<void> => {
      await pressKey(castTo(params));
    },
    name: 'pressKey'
  },
  {
    call: async (params): Promise<void> => {
      await typeIntoEditor(castTo(params));
    },
    name: 'typeIntoEditor'
  },
  {
    call: async (params): Promise<void> => {
      await unhoverElement(castTo(params));
    },
    name: 'unhoverElement'
  }
];

const PARAMS = { sentinel: true };

const desktop = castTo<Arm>(desktopArm);
const mobile = castTo<Arm>(mobileArm);

beforeEach(() => {
  vi.clearAllMocks();
  platformState.isDesktopApp = true;
});

describe.each(HELPER_CASES)('$name', (helperCase) => {
  it('should call the desktop arm on desktop, and only it', async () => {
    platformState.isDesktopApp = true;

    await helperCase.call(PARAMS);

    expect(desktop[helperCase.name]).toHaveBeenCalledExactlyOnceWith(PARAMS);
    expect(mobile[helperCase.name]).not.toHaveBeenCalled();
  });

  it('should call the mobile arm on mobile, and only it', async () => {
    platformState.isDesktopApp = false;

    await helperCase.call(PARAMS);

    expect(mobile[helperCase.name]).toHaveBeenCalledExactlyOnceWith(PARAMS);
    expect(desktop[helperCase.name]).not.toHaveBeenCalled();
  });
});

describe('the facade surface', () => {
  it('should cover every helper both arms export, so no name is left to a platform import', () => {
    expect(HELPER_CASES.map((helperCase) => helperCase.name)).toEqual(HELPER_NAMES);
  });

  it('should decide the platform per call, not once at import time', async () => {
    platformState.isDesktopApp = true;
    await pressKey(castTo(PARAMS));
    platformState.isDesktopApp = false;
    await pressKey(castTo(PARAMS));

    expect(desktop.pressKey).toHaveBeenCalledOnce();
    expect(mobile.pressKey).toHaveBeenCalledOnce();
  });
});
