import type { Debugger } from 'debug';

import debug from 'debug';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  enableLibraryDebuggers,
  getDebugController,
  getDebugger,
  getLibDebugger,
  printWithStackTrace,
  showInitialDebugMessage
} from '../src/Debug.ts';

describe('Debug', () => {
  let savedNamespaces: string;

  beforeEach(() => {
    savedNamespaces = debug.load() ?? '';
  });

  afterEach(() => {
    debug.enable(savedNamespaces);
  });

  describe('getDebugController', () => {
    it('should return an object with enable, disable, get, set methods', () => {
      const controller = getDebugController();
      expect(controller).toEqual(expect.objectContaining({
        disable: expect.any(Function),
        enable: expect.any(Function),
        get: expect.any(Function),
        set: expect.any(Function)
      }));
    });

    it('should update namespaces via set() and return them via get()', () => {
      const controller = getDebugController();
      controller.set('test-ns');
      expect(controller.get()).toContain('test-ns');
    });

    it('should add a namespace via enable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('my-namespace');
      expect(controller.get()).toContain('my-namespace');
    });

    it('should add negated namespace via disable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.disable('my-namespace');
      expect(controller.get()).toContain('-my-namespace');
    });

    it('should skip already-negated namespaces when disabling', () => {
      const controller = getDebugController();
      controller.set('-already-negated');
      controller.disable('-already-negated');
      const namespaces = controller.get();
      expect(namespaces.filter((ns) => ns === '-already-negated')).toHaveLength(1);
    });

    it('should remove negated version when enabling a namespace', () => {
      const controller = getDebugController();
      controller.set('-my-namespace');
      controller.enable('my-namespace');
      expect(controller.get()).not.toContain('-my-namespace');
    });

    it('should clear all namespaces when set() is called with empty string', () => {
      const controller = getDebugController();
      controller.set('ns-a,ns-b');
      controller.set('');
      expect(controller.get()).toEqual([]);
    });

    it('should set all namespaces when set() is called with an array', () => {
      const controller = getDebugController();
      controller.set(['ns-a', 'ns-b', 'ns-c']);
      expect(controller.get()).toEqual(['ns-a', 'ns-b', 'ns-c']);
    });
  });

  describe('enableLibraryDebuggers', () => {
    it('should enable the obsidian-dev-utils namespace', () => {
      debug.enable('');
      enableLibraryDebuggers();
      expect(debug.enabled('obsidian-dev-utils')).toBe(true);
    });

    it('should enable the obsidian-dev-utils:* wildcard namespace', () => {
      debug.enable('');
      enableLibraryDebuggers();
      expect(debug.enabled('obsidian-dev-utils:something')).toBe(true);
    });
  });

  describe('getDebugger', () => {
    it('should return a Debugger instance with enabled property', () => {
      const dbg = getDebugger('test-debugger-ns');
      expect(dbg).toHaveProperty('enabled');
    });

    it('should cache and return the same instance for same namespace and framesToSkip', () => {
      const dbg1 = getDebugger('cached-ns', 0);
      const dbg2 = getDebugger('cached-ns', 0);
      expect(dbg1).toBe(dbg2);
    });

    it('should return different instances for different namespaces', () => {
      const dbg1 = getDebugger('namespace-a');
      const dbg2 = getDebugger('namespace-b');
      expect(dbg1).not.toBe(dbg2);
    });
  });

  describe('getLibDebugger', () => {
    it('should return a debugger with library namespace prefix', () => {
      const dbg = getLibDebugger('my-module');
      expect(dbg.namespace).toContain('obsidian-dev-utils:my-module');
    });
  });

  describe('printWithStackTrace', () => {
    it('should call the debugger with message and args in Node environment', () => {
      debug.enable('print-test');
      const dbg = getDebugger('print-test');
      const spy = vi.fn() as unknown as Debugger;
      spy.enabled = true;
      printWithStackTrace(spy, 'fake-stack', 'hello %s', 'world');
      expect(spy).toHaveBeenCalledWith('hello %s', 'world');
    });
  });

  describe('showInitialDebugMessage', () => {
    it('should not throw when called with a plugin ID', () => {
      expect(() => showInitialDebugMessage('test-plugin-id')).not.toThrow();
    });
  });
});
