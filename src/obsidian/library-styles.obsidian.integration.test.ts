import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('library styles', () => {
  it('should inject the built library styles into the shared Obsidian document', async () => {
    const result = await evalInObsidian({
      fn() {
        const styleElement = activeDocument.head.querySelector('#obsidian-dev-utils-styles');
        return {
          hasStyle: styleElement !== null,
          length: styleElement?.textContent.length ?? 0
        };
      }
    });

    expect(result.hasStyle).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
