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
      // eslint-disable-next-line unicorn/no-error-property-assignment -- Setting `name` is how this fixture becomes the warning under test: the code being exercised dispatches on exactly that property.
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

    it('should skip registering when another module realm already installed its own listener object', () => {
      process.off('warning', throwOnWarning);

      // What a VM-backed pool produces: the same source evaluated in a second realm, so a DIFFERENT
      // function object with the same marker. Identity comparison misses it; the marker does not.
      function listenerFromAnotherRealm(): never {
        throw new Error('from another realm');
      }

      Object.defineProperty(listenerFromAnotherRealm, Symbol.for('obsidian-dev-utils:throwOnWarning'), { value: true });
      process.on('warning', listenerFromAnotherRealm);

      try {
        installWarningsAsErrors();
        expect(process.listeners('warning')).not.toContain(throwOnWarning);
        expect(process.listeners('warning').filter((listener) => listener === listenerFromAnotherRealm)).toHaveLength(1);
      } finally {
        process.off('warning', listenerFromAnotherRealm);
      }
    });
  });
});
