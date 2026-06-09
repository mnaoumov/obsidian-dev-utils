/**
 * @file
 *
 * Integration tests for {@link getDomEventsHandlersConstructor}.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  inject,
  it
} from 'vitest';

interface ConstructorProbe {
  isFunction: boolean;
  isHtmlElementSubclass: boolean;
  prototypeMethodNames: string[];
}

/*
 * The DomEventsHandlers prototype exposes the internal-link click handler at runtime (method names
 * are preserved in Obsidian's bundle even though the class name itself is minified). This is the
 * most fundamental handler of the contract; asserting one stable member confirms we extracted the
 * handler class while staying robust to Obsidian adding, removing, or renaming peripheral handlers.
 * The container element constructor that the original bug returned (an HTMLElement subclass) has no
 * such method.
 */
const CORE_HANDLER_METHOD = 'onInternalLinkClick';

describe('getDomEventsHandlersConstructor', () => {
  it('should extract the DomEventsHandlers constructor, not the container element constructor', async () => {
    const probe = await evalInObsidian<Record<string, never>, ConstructorProbe>({
      async fn({ app }) {
        const lib = window.__obsidianDevUtilsModule__;
        if (!lib) {
          throw new Error('obsidian-dev-utils module not registered on window');
        }
        const ctor = await lib.obsidian.constructors.getDomEventsHandlersConstructor.getDomEventsHandlersConstructor(app);
        const proto: object = ctor.prototype;
        const prototypeMethodNames = Object.getOwnPropertyNames(proto)
          .filter((name) => {
            if (name === 'constructor') {
              return false;
            }
            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            return typeof descriptor?.value === 'function';
          });
        return {
          isFunction: typeof ctor === 'function',
          /*
           * The bug returned the container element's constructor (an HTMLElement subclass such as
           * HTMLDivElement) instead of the DomEventsHandlers constructor. Both are functions, so a
           * bare `typeof ctor === 'function'` check passed even while broken.
           */
          isHtmlElementSubclass: proto instanceof HTMLElement,
          prototypeMethodNames
        };
      },
      vaultPath: inject('tempVaultPath')
    });

    expect(probe.isFunction).toBe(true);
    expect(probe.isHtmlElementSubclass).toBe(false);
    expect(probe.prototypeMethodNames).toContain(CORE_HANDLER_METHOD);
  });
});
