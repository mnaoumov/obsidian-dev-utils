import type { MockInstance } from 'vitest';

import {
  afterEach,
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
} from './mobile-trusted-input.ts';

interface HelperCase {
  /**
   * Calls the module's helper with the sentinel params, so the test never has to build a real
   * `HTMLElement` or `Editor` just to watch it be forwarded.
   */
  call(params: object): Promise<void>;

  /**
   * The seam member the helper must delegate to.
   */
  name: string;
}

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

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSeam(memberNames: string[]): Record<string, MockInstance> {
  const trustedInput: Record<string, MockInstance> = {};
  for (const memberName of memberNames) {
    trustedInput[memberName] = vi.fn().mockResolvedValue(undefined);
  }
  vi.stubGlobal('__obsidianIntegrationTesting', { trustedInput });
  return trustedInput;
}

describe.each(HELPER_CASES)('$name', (helperCase) => {
  it('should delegate to the harness seam, passing the params through untouched', async () => {
    const trustedInput = stubSeam(HELPER_CASES.map((otherCase) => otherCase.name));

    await helperCase.call(PARAMS);

    expect(trustedInput[helperCase.name]).toHaveBeenCalledExactlyOnceWith(PARAMS);
  });

  it('should throw when the seam does not carry that member', async () => {
    stubSeam(HELPER_CASES.map((otherCase) => otherCase.name).filter((name) => name !== helperCase.name));

    await expect(helperCase.call(PARAMS)).rejects.toThrow(`\`window.__obsidianIntegrationTesting.trustedInput.${helperCase.name}\` is not installed`);
  });
});

describe('the harness namespace', () => {
  it('should throw when it is absent entirely — the app was not bootstrapped by the harness', async () => {
    await expect(clickElement(castTo(PARAMS))).rejects.toThrow('Trusted input is unavailable on mobile');
  });

  it('should throw when it is present without a trustedInput seam — an older harness', async () => {
    vi.stubGlobal('__obsidianIntegrationTesting', {});

    await expect(clickElement(castTo(PARAMS))).rejects.toThrow('Trusted input is unavailable on mobile');
  });

  it('should name the Appium transport in the message, so the cause is not a guess', async () => {
    await expect(clickElement(castTo(PARAMS))).rejects.toThrow('Appium transport');
  });
});
