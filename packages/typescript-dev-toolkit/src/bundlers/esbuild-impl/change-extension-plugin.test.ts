import {
  describe,
  expect,
  it
} from 'vitest';

import { rewriteImportPathExtensions } from './change-extension-plugin.ts';

describe('rewriteImportPathExtensions', () => {
  describe.each([
    '.mjs',
    '.cjs'
  ])('extension %s', (extension) => {
    it('rewrites require() paths', () => {
      expect(rewriteImportPathExtensions('require(\'../foo.ts\')', extension)).toBe(`require('../foo${extension}')`);
    });

    it('rewrites double-quoted require() paths', () => {
      expect(rewriteImportPathExtensions('require("../foo.ts")', extension)).toBe(`require('../foo${extension}')`);
    });

    it('rewrites static from paths', () => {
      expect(rewriteImportPathExtensions('export { foo } from "../foo.ts";', extension)).toBe(`export { foo } from "../foo${extension}";`);
    });

    it('rewrites dynamic import() paths', () => {
      expect(rewriteImportPathExtensions('const { foo } = await import("../foo.ts");', extension)).toBe(`const { foo } = await import("../foo${extension}");`);
    });

    it('rewrites single-quoted dynamic import() paths', () => {
      expect(rewriteImportPathExtensions('const { foo } = await import(\'../foo.ts\');', extension)).toBe(`const { foo } = await import("../foo${extension}");`);
    });

    it('leaves an already-resolved dynamic import() path untouched', () => {
      expect(rewriteImportPathExtensions('import("../foo.mjs")', extension)).toBe('import("../foo.mjs")');
    });

    it('rewrites the open-demo-vault regression case', () => {
      const source = 'const { openDemoVault } = await import("../desktop-demo-vault-opener.ts");';
      const expected = `const { openDemoVault } = await import("../desktop-demo-vault-opener${extension}");`;
      expect(rewriteImportPathExtensions(source, extension)).toBe(expected);
    });
  });
});
