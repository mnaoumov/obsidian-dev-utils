import {
  describe,
  expect,
  it
} from 'vitest';

import { assertMobileLoadableBundle } from './assert-mobile-loadable-bundle.ts';

const BUNDLE_PATH = 'dist/integration-test-plugin/main.js';

function loadBundle(bundleSource: string): void {
  assertMobileLoadableBundle({
    bundlePath: BUNDLE_PATH,
    bundleSource
  });
}

describe('assertMobileLoadableBundle', () => {
  it('accepts a bundle whose top level touches nothing platform-only', () => {
    expect(() => {
      loadBundle('"use strict"; var answer = 42; module.exports = { answer };');
    }).not.toThrow();
  });

  it('accepts a bundle whose top level reads an Obsidian external, which mobile does provide', () => {
    expect(() => {
      loadBundle('"use strict"; var Plugin = require("obsidian").Plugin; module.exports = class extends Plugin {};');
    }).not.toThrow();
  });

  it('accepts a bundle whose top level branches on the renderer-shaped process, the way `debug` does', () => {
    expect(() => {
      loadBundle('"use strict"; if (typeof process === "undefined" || process.type === "renderer") { module.exports = {}; } else { require("util").deprecate(); }');
    }).not.toThrow();
  });

  it('accepts a bundle that only reaches a Node builtin lazily, which is the shape rule L6 prescribes', () => {
    expect(() => {
      loadBundle('"use strict"; module.exports = { extract: function () { var { randomFillSync } = require("crypto"); return randomFillSync; } };');
    }).not.toThrow();
  });

  it('rejects a bundle whose top level unpacks a Node builtin, the way `adm-zip` does', () => {
    expect(() => {
      loadBundle('"use strict"; var { randomFillSync } = require("crypto");');
    }).toThrow(/cannot load on Obsidian mobile/);
  });

  it('names the bundle and the underlying reason, so the offending module is identifiable', () => {
    let message = '';
    try {
      loadBundle('"use strict"; var { randomFillSync } = require("crypto");');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(BUNDLE_PATH);
    expect(message).toContain('Cannot destructure property');
    expect(message).toContain('randomFillSync');
  });
});
