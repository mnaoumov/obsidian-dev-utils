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
import { noop } from '../src/Function.ts';
import { castTo } from '../src/ObjectUtils.ts';
import {
  NO_PLUGIN_ID_INITIALIZED,
  setPluginId
} from '../src/obsidian/Plugin/PluginId.ts';
import { assertNonNullable } from '../src/TypeGuards.ts';

describe('Debug', () => {
  let savedNamespaces: string;

  beforeEach(() => {
    savedNamespaces = debug.load() ?? '';
    debug.enable('');
  });

  afterEach(() => {
    debug.enable(savedNamespaces);
    setPluginId(NO_PLUGIN_ID_INITIALIZED);
    vi.restoreAllMocks();
  });

  describe('getDebugController', () => {
    it('should return an object with enable, disable, get, set methods', () => {
      const controller = getDebugController();
      expect(controller).toEqual(expect.objectContaining({
        disable: expect.any(Function) as unknown,
        enable: expect.any(Function) as unknown,
        get: expect.any(Function) as unknown,
        set: expect.any(Function) as unknown
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

    it('should support comma-separated string in enable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('ns-x,ns-y');
      const namespaces = controller.get();
      expect(namespaces).toContain('ns-x');
      expect(namespaces).toContain('ns-y');
    });

    it('should support comma-separated string in disable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.disable('ns-x,ns-y');
      const namespaces = controller.get();
      expect(namespaces).toContain('-ns-x');
      expect(namespaces).toContain('-ns-y');
    });

    it('should support array of namespaces in enable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable(['ns-a', 'ns-b']);
      const namespaces = controller.get();
      expect(namespaces).toContain('ns-a');
      expect(namespaces).toContain('ns-b');
    });

    it('should support array of namespaces in disable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.disable(['ns-a', 'ns-b']);
      const namespaces = controller.get();
      expect(namespaces).toContain('-ns-a');
      expect(namespaces).toContain('-ns-b');
    });

    it('should remove a previously-enabled namespace when disabling it', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('my-namespace');
      controller.disable('my-namespace');
      const namespaces = controller.get();
      expect(namespaces).not.toContain('my-namespace');
      expect(namespaces).toContain('-my-namespace');
    });

    it('should allow enabling a negated namespace directly', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('-explicit-negated');
      expect(controller.get()).toContain('-explicit-negated');
    });

    it('should preserve existing namespaces when enabling additional ones', () => {
      const controller = getDebugController();
      controller.set('existing');
      controller.enable('additional');
      const namespaces = controller.get();
      expect(namespaces).toContain('existing');
      expect(namespaces).toContain('additional');
    });

    it('should preserve existing namespaces when disabling additional ones', () => {
      const controller = getDebugController();
      controller.set('existing');
      controller.disable('other');
      const namespaces = controller.get();
      expect(namespaces).toContain('existing');
      expect(namespaces).toContain('-other');
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

    it('should enable deeply nested obsidian-dev-utils sub-namespaces', () => {
      debug.enable('');
      enableLibraryDebuggers();
      expect(debug.enabled('obsidian-dev-utils:foo:bar')).toBe(true);
    });

    it('should not enable unrelated namespaces', () => {
      debug.enable('');
      enableLibraryDebuggers();
      expect(debug.enabled('some-other-lib')).toBe(false);
    });
  });

  describe('getDebugger', () => {
    it('should return a Debugger instance with enabled property', () => {
      const dbg = getDebugger('test-debugger-ns');
      expect(dbg).toHaveProperty('enabled');
    });

    it('should return a Debugger instance with namespace property', () => {
      const dbg = getDebugger('test-debugger-ns');
      expect(dbg.namespace).toBe('test-debugger-ns');
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

    it('should return different instances for different framesToSkip values', () => {
      const dbg1 = getDebugger('same-ns', 0);
      const dbg2 = getDebugger('same-ns', 1);
      expect(dbg1).not.toBe(dbg2);
    });

    it('should default framesToSkip to 0', () => {
      const dbgDefault = getDebugger('default-frames');
      const dbgExplicit = getDebugger('default-frames', 0);
      expect(dbgDefault).toBe(dbgExplicit);
    });

    it('should have a custom log function that calls console.debug in Node environment', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('log-test-ns');
      const dbg = getDebugger('log-test-ns');
      dbg('test message %s', 'arg1');
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      assertNonNullable(callArgs);
      expect(callArgs[0]).toContain('test message');
    });

    it('should not call console.debug when the namespace is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('');
      const dbg = getDebugger('disabled-log-ns');
      dbg('should not appear');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should return early from logWithCaller when namespace is disabled and log is called directly', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('');
      const dbg = getDebugger('direct-log-disabled-ns');
      assertNonNullable(dbg.log);
      dbg.log('direct call test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('getLibDebugger', () => {
    it('should return a debugger with library namespace prefix when no plugin ID is set', () => {
      const dbg = getLibDebugger('my-module');
      expect(dbg.namespace).toBe('obsidian-dev-utils:my-module');
    });

    it('should include plugin ID prefix when a plugin ID is set', () => {
      setPluginId('test-plugin');
      const dbg = getLibDebugger('my-module');
      expect(dbg.namespace).toBe('test-plugin:obsidian-dev-utils:my-module');
    });

    it('should not include prefix when plugin ID is NOT_PLUGIN_ID_INITIALIZED', () => {
      const dbg = getLibDebugger('some-module');
      expect(dbg.namespace).not.toContain(NO_PLUGIN_ID_INITIALIZED);
      expect(dbg.namespace).toBe('obsidian-dev-utils:some-module');
    });
  });

  describe('printWithStackTrace', () => {
    it('should call the debugger with message and args in Node environment (no window)', () => {
      debug.enable('print-test');
      const spy = castTo<Debugger>(vi.fn());
      spy.enabled = true;
      printWithStackTrace(spy, 'fake-stack', 'hello %s', 'world');
      expect(spy).toHaveBeenCalledWith('hello %s', 'world');
    });

    it('should not include stack trace info in Node environment', () => {
      debug.enable('print-test-2');
      const spy = castTo<Debugger>(vi.fn());
      spy.enabled = true;
      printWithStackTrace(spy, 'fake-stack', 'msg');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('msg');
    });

    it('should call the debugger with no extra arguments when none provided', () => {
      debug.enable('print-test-3');
      const spy = castTo<Debugger>(vi.fn());
      spy.enabled = true;
      printWithStackTrace(spy, 'stack-trace', 'simple message');
      expect(spy).toHaveBeenCalledWith('simple message');
    });

    it('should call the debugger with multiple args', () => {
      debug.enable('print-test-4');
      const spy = castTo<Debugger>(vi.fn());
      spy.enabled = true;
      printWithStackTrace(spy, 'stack', '%s %d %o', 'a', 1, { x: 2 });
      expect(spy).toHaveBeenCalledWith('%s %d %o', 'a', 1, { x: 2 });
    });
  });

  describe('showInitialDebugMessage', () => {
    it('should not throw when called with a plugin ID', () => {
      expect(() => {
        showInitialDebugMessage('test-plugin-id');
      }).not.toThrow();
    });

    it('should produce console.debug output when the plugin namespace is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('show-msg-plugin');
      showInitialDebugMessage('show-msg-plugin');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include the plugin ID in the debug message', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('my-plugin-for-msg');
      showInitialDebugMessage('my-plugin-for-msg');
      const allArgs = consoleSpy.mock.calls.flat().join(' ');
      expect(allArgs).toContain('my-plugin-for-msg');
    });

    it('should indicate enabled state when plugin namespace is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(noop);
      debug.enable('enabled-plugin');
      showInitialDebugMessage('enabled-plugin');
      const allArgs = consoleSpy.mock.calls.flat().join(' ');
      expect(allArgs).toContain('enabled');
    });

    it('should restore original namespaces after showing the message', () => {
      const controller = getDebugController();
      controller.set('original-ns');
      showInitialDebugMessage('temp-plugin');
      const namespaces = controller.get();
      expect(namespaces).toContain('original-ns');
    });

    it('should restore empty namespaces after showing the message when none were set', () => {
      const controller = getDebugController();
      controller.set('');
      showInitialDebugMessage('temp-plugin');
      expect(controller.get()).toEqual([]);
    });
  });

  describe('DebugController enable/disable/get/set cycle', () => {
    it('should support a full enable-then-disable-then-enable cycle', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('cycle-ns');
      expect(controller.get()).toContain('cycle-ns');
      controller.disable('cycle-ns');
      expect(controller.get()).not.toContain('cycle-ns');
      expect(controller.get()).toContain('-cycle-ns');
      controller.enable('cycle-ns');
      expect(controller.get()).not.toContain('-cycle-ns');
      expect(controller.get()).toContain('cycle-ns');
    });

    it('should handle multiple namespaces in a single enable() call', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable(['alpha', 'beta', 'gamma']);
      const namespaces = controller.get();
      expect(namespaces).toContain('alpha');
      expect(namespaces).toContain('beta');
      expect(namespaces).toContain('gamma');
    });

    it('should handle multiple namespaces in a single disable() call', () => {
      const controller = getDebugController();
      controller.set('alpha,beta,gamma');
      controller.disable(['alpha', 'gamma']);
      const namespaces = controller.get();
      expect(namespaces).not.toContain('alpha');
      expect(namespaces).toContain('-alpha');
      expect(namespaces).toContain('beta');
      expect(namespaces).not.toContain('gamma');
      expect(namespaces).toContain('-gamma');
    });

    it('should not duplicate a namespace when enabling it multiple times', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('dup-ns');
      controller.enable('dup-ns');
      const namespaces = controller.get();
      expect(namespaces.filter((ns) => ns === 'dup-ns')).toHaveLength(1);
    });

    it('should not duplicate a negated namespace when disabling it multiple times', () => {
      const controller = getDebugController();
      controller.set('');
      controller.disable('dup-ns');
      controller.disable('dup-ns');
      const namespaces = controller.get();
      expect(namespaces.filter((ns) => ns === '-dup-ns')).toHaveLength(1);
    });

    it('should handle wildcard namespaces', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('my-app:*');
      expect(controller.get()).toContain('my-app:*');
    });

    it('should handle mixed enable and disable with wildcards', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable('*');
      controller.disable('noisy-ns');
      const namespaces = controller.get();
      expect(namespaces).toContain('*');
      expect(namespaces).toContain('-noisy-ns');
    });

    it('should support nested array of namespaces in enable()', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable([castTo<string>(['nested-a', 'nested-b']), 'flat-c']);
      const namespaces = controller.get();
      expect(namespaces).toContain('nested-a');
      expect(namespaces).toContain('nested-b');
      expect(namespaces).toContain('flat-c');
    });

    it('should handle comma-separated values within array elements', () => {
      const controller = getDebugController();
      controller.set('');
      controller.enable(['a,b', 'c']);
      const namespaces = controller.get();
      expect(namespaces).toContain('a');
      expect(namespaces).toContain('b');
      expect(namespaces).toContain('c');
    });
  });
});
