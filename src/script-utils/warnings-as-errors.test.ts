import process from 'node:process';
import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  installWarningsAsErrors,
  throwOnWarning
} from './warnings-as-errors.ts';

describe('warnings-as-errors', () => {
  afterEach(() => {
    process.off('warning', throwOnWarning);
  });

  describe('throwOnWarning', () => {
    it('should rethrow the warning as an error, attaching the original as cause', () => {
      const warning = new Error('boom');
      warning.name = 'ExperimentalWarning';

      let thrown: unknown;
      try {
        throwOnWarning(warning);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('Node emitted a warning, which is treated as a test failure: ExperimentalWarning: boom');
      expect((thrown as Error).cause).toBe(warning);
    });
  });

  describe('installWarningsAsErrors', () => {
    it('should register the warning listener exactly once, even when called repeatedly', () => {
      process.off('warning', throwOnWarning);
      expect(process.listeners('warning')).not.toContain(throwOnWarning);

      installWarningsAsErrors();
      expect(process.listeners('warning').filter((listener) => listener === throwOnWarning)).toHaveLength(1);

      installWarningsAsErrors();
      expect(process.listeners('warning').filter((listener) => listener === throwOnWarning)).toHaveLength(1);
    });
  });
});
