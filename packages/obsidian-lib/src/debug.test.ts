import { Library } from '@mnaoumov/typescript-lib/library';
import {
  describe,
  expect,
  it
} from 'vitest';

import { getObsidianLibDebugger } from './debug.ts';

describe('getObsidianLibDebugger', () => {
  it('should keep the library namespace before the plugin context is initialized', () => {
    expect(getObsidianLibDebugger('PluginApi').namespace).toBe('obsidian-dev-utils:PluginApi');
  });

  it('should keep the library namespace when the generic library logs under another one', () => {
    Library.init({ debugNamespace: 'something-else', debugPrefixNamespace: 'my-plugin:', shouldPrintStackTrace: false });
    expect(getObsidianLibDebugger('PluginApi').namespace).toBe('my-plugin:obsidian-dev-utils:PluginApi');
  });
});
