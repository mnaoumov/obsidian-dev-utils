import {
  describe,
  expect,
  it
} from 'vitest';

import {
  LIBRARY_STYLES,
  LIBRARY_VERSION
} from './generated-during-build.ts';

describe('generated-during-build', () => {
  it('should expose the library version as a string constant', () => {
    expect(typeof LIBRARY_VERSION).toBe('string');
  });

  it('should expose the library styles as a string constant', () => {
    expect(typeof LIBRARY_STYLES).toBe('string');
  });
});
