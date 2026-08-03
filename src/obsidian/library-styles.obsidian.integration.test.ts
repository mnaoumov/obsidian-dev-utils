import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('library styles', () => {
  it('should inject the built library styles into the shared Obsidian document', async () => {
    const result = await evalInObsidian({
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is declared by `obsidian-integration-testing`; renaming it here would not match the API.
      fn() {
        const styleEl = activeDocument.head.querySelector('#obsidian-dev-utils-styles');
        return {
          hasStyle: styleEl !== null,
          length: styleEl?.textContent.length ?? 0
        };
      }
    });

    expect(result.hasStyle).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
