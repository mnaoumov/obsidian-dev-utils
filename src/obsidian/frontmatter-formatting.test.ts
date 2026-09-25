import { stringifyYaml } from 'obsidian';
import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import { castTo } from '../object-utils.ts';
import { ensureNonNullable } from '../type-guards.ts';
import {
  enableFrontmatterFormattingPreservation,
  preserveFrontmatterFormatting
} from './frontmatter-formatting.ts';
import {
  parseFrontmatter,
  registerFrontmatterFormattingPreserver,
  setFrontmatter
} from './frontmatter.ts';

const BODY = 'Body text\n';
const OPENING_DELIMITER = '---\n';
const CLOSING_DELIMITER_AND_BODY = `---\n${BODY}`;

function makeNote(frontmatterBody: string): string {
  return `${OPENING_DELIMITER}${frontmatterBody}${CLOSING_DELIMITER_AND_BODY}`;
}

/**
 * Splices a block by mutating its own parsed projection, which is what a `processFrontmatter()` callback does — and
 * which is what keeps the new front matter in the source's key order unless a case deliberately changes it.
 */
function spliceMutated(frontmatterBody: string, mutate: (frontmatter: GenericObject) => void): null | string {
  const note = makeNote(frontmatterBody);
  const frontmatter = parseFrontmatter(note);
  mutate(frontmatter);
  return spliceRaw(frontmatterBody, frontmatter);
}

function spliceRaw(frontmatterBody: string, newFrontmatter: object): null | string {
  const result = preserveFrontmatterFormatting(makeNote(frontmatterBody), newFrontmatter);
  if (result === null) {
    return null;
  }

  expect(result.endsWith(CLOSING_DELIMITER_AND_BODY)).toBe(true);
  return result.slice(OPENING_DELIMITER.length, result.length - CLOSING_DELIMITER_AND_BODY.length);
}

describe('preserveFrontmatterFormatting', () => {
  describe('declining a note it cannot be faithful about', () => {
    it('should decline a note with no frontmatter block', () => {
      expect(preserveFrontmatterFormatting('Body only', { title: 'New' })).toBeNull();
    });

    it('should decline an empty new frontmatter, which is a block deletion', () => {
      expect(preserveFrontmatterFormatting(makeNote('title: Old\n'), {})).toBeNull();
    });

    it('should decline an empty frontmatter block, which has no formatting to keep', () => {
      expect(spliceRaw('\n', { title: 'New' })).toBeNull();
    });

    it('should decline a block with no line between its delimiters, the one block that does not end in a newline', () => {
      expect(preserveFrontmatterFormatting(`${OPENING_DELIMITER}${CLOSING_DELIMITER_AND_BODY}`, { title: 'New' })).toBeNull();
    });

    it('should decline a block whose body is a scalar', () => {
      expect(spliceRaw('just text\n', { title: 'New' })).toBeNull();
    });

    it('should decline a block whose body is a sequence', () => {
      expect(spliceRaw('- a\n- b\n', { title: 'New' })).toBeNull();
    });

    it('should decline a block that does not parse', () => {
      expect(spliceRaw('a: 1\nb: [unclosed\n', { a: 1 })).toBeNull();
    });

    it('should decline a block with duplicate keys, which the parser reports as an error', () => {
      expect(spliceRaw('a: 1\na: 2\n', { a: 3 })).toBeNull();
    });

    it('should decline a block with an unresolved tag', () => {
      expect(spliceRaw('a: !custom 1\nb: 2\n', { a: '1', b: 3 })).toBeNull();
    });

    it('should decline a block with an anchor', () => {
      expect(spliceRaw('anchored: &x 1\nb: 2\n', { anchored: 1, b: 3 })).toBeNull();
    });

    it('should decline a block with an alias', () => {
      expect(spliceRaw('anchored: &x 1\nref: *x\n', { anchored: 1, ref: 2 })).toBeNull();
    });

    it('should decline a block whose end marker starts a second document', () => {
      expect(spliceRaw('a: 1\n...\nb: 2\n', { a: 2 })).toBeNull();
    });

    it('should decline a block whose keys collide once projected to strings', () => {
      expect(spliceRaw('42: numeric\n"42": string\n', { 42: 'changed' })).toBeNull();
    });

    it('should decline a block with an item no key names', () => {
      expect(spliceRaw(': value\nother: 1\n', { '': 'value', 'other': 2 })).toBeNull();
    });
  });

  describe('keeping what the change does not reach', () => {
    it('should return the block unchanged when nothing changed', () => {
      const frontmatterBody = 'title: Hello   # a comment\n\ntags:\n  - alpha\n';
      expect(spliceMutated(frontmatterBody, () => undefined)).toBe(frontmatterBody);
    });

    it('should keep the comment of a key it did not touch', () => {
      expect(spliceMutated('title: Hello   # a comment\ncount: 1\n', (frontmatter) => {
        frontmatter['count'] = 2;
      })).toBe('title: Hello   # a comment\ncount: 2\n');
    });

    it('should keep the quoting style of a key it did not touch', () => {
      expect(spliceMutated('quoted: \'single\'\ncount: 1\n', (frontmatter) => {
        frontmatter['count'] = 2;
      })).toBe('quoted: \'single\'\ncount: 2\n');
    });

    it('should keep consecutive blank lines', () => {
      expect(spliceMutated('a: 1\n\n\nb: 2\n', (frontmatter) => {
        frontmatter['b'] = 3;
      })).toBe('a: 1\n\n\nb: 3\n');
    });

    it('should keep a four-space indent', () => {
      expect(spliceMutated('deep:\n    four: 1\n    other: 2\n', (frontmatter) => {
        (frontmatter['deep'] as GenericObject)['other'] = 3;
      })).toBe('deep:\n    four: 1\n    other: 3\n');
    });

    it('should keep a flow collection in flow style', () => {
      expect(spliceMutated('list: [a, b]\ncount: 1\n', (frontmatter) => {
        (frontmatter['list'] as string[])[1] = 'c';
      })).toBe('list: [a, c]\ncount: 1\n');
    });

    it('should keep a flow collection in flow style when it grows', () => {
      expect(spliceMutated('list: [a, b]\n', (frontmatter) => {
        (frontmatter['list'] as string[]).push('c');
      })).toBe('list: [a, b, c]\n');
    });

    it('should keep a literal block scalar it did not touch', () => {
      expect(spliceMutated('lit: |\n  one\n  two\ncount: 1\n', (frontmatter) => {
        frontmatter['count'] = 2;
      })).toBe('lit: |\n  one\n  two\ncount: 2\n');
    });

    it('should keep a folded block scalar it did not touch', () => {
      expect(spliceMutated('folded: >\n  one\n  two\ncount: 1\n', (frontmatter) => {
        frontmatter['count'] = 2;
      })).toBe('folded: >\n  one\n  two\ncount: 2\n');
    });

    it('should keep an explicit key, which no emit option can restore', () => {
      expect(spliceMutated('? explicit\n: value\nother: 1\n', (frontmatter) => {
        frontmatter['other'] = 2;
      })).toBe('? explicit\n: value\nother: 2\n');
    });

    it('should keep a comment that follows the whole block', () => {
      expect(spliceMutated('a: 1\n# trailing\n', (frontmatter) => {
        frontmatter['a'] = 2;
      })).toBe('a: 2\n# trailing\n');
    });

    it('should keep a comment that precedes the whole block', () => {
      expect(spliceMutated('# leading\na: 1\n', (frontmatter) => {
        frontmatter['a'] = 2;
      })).toBe('# leading\na: 2\n');
    });

    it('should keep a numeric key unquoted, where the rewrite would quote it', () => {
      expect(spliceMutated('42: answer\nother: 1\n', (frontmatter) => {
        frontmatter['other'] = 2;
      })).toBe('42: answer\nother: 2\n');
    });

    it('should keep a boolean key unquoted', () => {
      expect(spliceMutated('true: yes\nother: 1\n', (frontmatter) => {
        frontmatter['other'] = 2;
      })).toBe('true: yes\nother: 2\n');
    });

    it('should keep the comment of a sequence item it did not touch', () => {
      expect(spliceMutated('tags:\n  - alpha   # a\n  - beta\n', (frontmatter) => {
        (frontmatter['tags'] as string[]).push('gamma');
      })).toBe('tags:\n  - alpha   # a\n  - beta\n  - gamma\n');
    });

    it('should keep a sequence written flush with its key rather than indented under it', () => {
      expect(spliceMutated('tags:\n- alpha   # a\n- beta\n', (frontmatter) => {
        (frontmatter['tags'] as string[]).push('gamma');
      })).toBe('tags:\n- alpha   # a\n- beta\n- gamma\n');
    });

    it('should keep the comment of a surviving sequence item when an earlier one is removed', () => {
      expect(spliceMutated('tags:\n  - alpha\n  - beta   # b\n', (frontmatter) => {
        (frontmatter['tags'] as string[]).shift();
      })).toBe('tags:\n  - beta   # b\n');
    });

    it('should keep the indent of the item after a valueless sequence item it replaced', () => {
      // A valueless item absorbs the newline AND the next line's indent, so replacing it without repairing that
      // leaves its successor flush with the key and the block no longer parses.
      expect(spliceMutated('flag:\n  - \n  - yes\n', (frontmatter) => {
        (frontmatter['flag'] as unknown[])[0] = 3.5;
      })).toBe('flag:\n  - 3.5\n  - yes\n');
    });

    it('should keep the indent of the key after a valueless nested key it removed', () => {
      expect(spliceMutated('nested:\n  a:\n  b: 2\n', (frontmatter) => {
        delete (frontmatter['nested'] as GenericObject)['a'];
      })).toBe('nested:\n  b: 2\n');
    });

    it('should keep the comment of a nested key when an earlier sibling is removed', () => {
      expect(spliceMutated('nested:\n  a: 1\n  # why b\n  b: 2\n', (frontmatter) => {
        delete (frontmatter['nested'] as GenericObject)['a'];
      })).toBe('nested:\n  # why b\n  b: 2\n');
    });

    it('should keep a date value unchanged', () => {
      expect(spliceMutated('when: 2024-01-02\ncount: 1\n', (frontmatter) => {
        frontmatter['count'] = 2;
      })).toBe('when: 2024-01-02\ncount: 2\n');
    });

    it('should keep a null value written as a bare key', () => {
      expect(spliceMutated('a:\nb: 1\n', (frontmatter) => {
        frontmatter['b'] = 2;
      })).toBe('a:\nb: 2\n');
    });

    it('should keep the blank line a block ends on', () => {
      expect(spliceMutated('a: 1\n\n', (frontmatter) => {
        frontmatter['a'] = 2;
      })).toBe('a: 2\n\n');
    });

    it('should keep a nested mapping separated from its key by a blank line', () => {
      expect(spliceMutated('nested:\n\n  a: 1\n  b: 2\n', (frontmatter) => {
        (frontmatter['nested'] as GenericObject)['a'] = 9;
      })).toBe('nested:\n\n  a: 9\n  b: 2\n');
    });

    it('should keep a flow collection that is a sequence item in flow style', () => {
      expect(spliceMutated('matrix:\n  - [1, 2]\n  - [3]\n', (frontmatter) => {
        ensureNonNullable((frontmatter['matrix'] as number[][])[1]).push(4);
      })).toBe('matrix:\n  - [1, 2]\n  - [3, 4]\n');
    });
  });

  describe('applying the change', () => {
    it('should append a key that is new', () => {
      expect(spliceMutated('a: 1\n', (frontmatter) => {
        frontmatter['added'] = 'value';
      })).toBe('a: 1\nadded: value\n');
    });

    it('should append a nested key that is new, at the indent of its siblings', () => {
      expect(spliceMutated('nested:\n  a: 1\n', (frontmatter) => {
        (frontmatter['nested'] as GenericObject)['added'] = { deep: [1, 2] };
      })).toBe('nested:\n  a: 1\n  added:\n    deep:\n      - 1\n      - 2\n');
    });

    it('should drop a key whose value is `undefined`, as the rewrite would', () => {
      expect(spliceMutated('a: 1\n', (frontmatter) => {
        frontmatter['added'] = undefined;
      })).toBe('a: 1\n');
    });

    it('should keep the closing delimiter on its own line when the last key is removed', () => {
      const note = makeNote('a: 1\nb: 2\n');
      const frontmatter = parseFrontmatter(note);
      delete frontmatter['b'];
      expect(preserveFrontmatterFormatting(note, frontmatter)).toBe(makeNote('a: 1\n'));
    });

    it('should keep every key on its own line when the former last key moves first', () => {
      expect(spliceRaw('b: 2\nc: 3\na: 1\n', { a: 1, b: 2, c: 3 })).toBe('a: 1\nb: 2\nc: 3\n');
    });

    it('should remove a key together with the comment that introduced it', () => {
      expect(spliceMutated('a: 1\n# why b\nb: 2\nc: 3\n', (frontmatter) => {
        delete frontmatter['b'];
      })).toBe('a: 1\nc: 3\n');
    });

    it('should drop the blank line that led the new first key', () => {
      expect(spliceMutated('a: 1\n\n# why b\nb: 2\n', (frontmatter) => {
        delete frontmatter['a'];
      })).toBe('# why b\nb: 2\n');
    });

    it('should reorder keys when the new front matter orders them differently', () => {
      expect(spliceRaw('b: 2   # second\na: 1\n', { a: 1, b: 2 })).toBe('a: 1\nb: 2   # second\n');
    });

    it('should replace a scalar with a mapping', () => {
      expect(spliceMutated('title: Hello\nkeep: 1\n', (frontmatter) => {
        frontmatter['title'] = { deep: true };
      })).toBe('title:\n  deep: true\nkeep: 1\n');
    });

    it('should replace a value with nothing when it becomes `null`', () => {
      expect(spliceMutated('a: 1\nb: 2\n', (frontmatter) => {
        frontmatter['a'] = null;
      })).toBe('a:\nb: 2\n');
    });

    it('should replace a mapping with a scalar', () => {
      expect(spliceMutated('nested:\n  a: 1\nkeep: 2\n', (frontmatter) => {
        frontmatter['nested'] = 'flat';
      })).toBe('nested: flat\nkeep: 2\n');
    });

    it('should replace an emptied sequence with a flow empty sequence', () => {
      expect(spliceMutated('tags:\n  - a\n  - b\nkeep: 1\n', (frontmatter) => {
        frontmatter['tags'] = [];
      })).toBe('tags: []\nkeep: 1\n');
    });

    it('should replace an emptied mapping with a flow empty mapping', () => {
      expect(spliceMutated('nested:\n  a: 1\nkeep: 1\n', (frontmatter) => {
        frontmatter['nested'] = {};
      })).toBe('nested: {}\nkeep: 1\n');
    });

    it('should rewrite a mapping nested in a sequence item in place', () => {
      expect(spliceMutated('rows:\n  - name: a\n    qty: 1\n  - name: b\n    qty: 2\n', (frontmatter) => {
        ensureNonNullable((frontmatter['rows'] as GenericObject[])[0])['qty'] = 9;
      })).toBe('rows:\n  - name: a\n    qty: 9\n  - name: b\n    qty: 2\n');
    });

    it('should rewrite a sequence nested in a sequence item in place', () => {
      expect(spliceMutated('matrix:\n  - - 1\n    - 2\n  - - 3\n', (frontmatter) => {
        ensureNonNullable((frontmatter['matrix'] as number[][])[1]).push(4);
      })).toBe('matrix:\n  - - 1\n    - 2\n  - - 3\n    - 4\n');
    });

    it('should rewrite a nested mapping whose first key sits on its own line', () => {
      expect(spliceMutated('nested:\n  a: 1\n  b: 2\n', (frontmatter) => {
        (frontmatter['nested'] as GenericObject)['a'] = 9;
      })).toBe('nested:\n  a: 9\n  b: 2\n');
    });

    it('should replace every key when none of them survives', () => {
      expect(spliceRaw('a: 1\nb: 2\n', { x: 'new', y: 'also' })).toBe('x: new\ny: also\n');
    });

    it('should rewrite a sequence longer than the edit script bears, by re-emitting it whole', () => {
      const oldItems = Array.from({ length: 101 }, (_item, index) => `item-${String(index)}`);
      const newItems = [...oldItems.slice(1), 'item-new'];
      const frontmatterBody = `tags:\n${oldItems.map((item) => `  - ${item}\n`).join('')}`;
      expect(spliceMutated(frontmatterBody, (frontmatter) => {
        frontmatter['tags'] = newItems;
      })).toBe(`tags:\n${newItems.map((item) => `  - ${item}\n`).join('')}`);
    });
  });

  describe('the safety net', () => {
    it('should decline a value the comparison cannot prove equal to itself', () => {
      // `NaN` is never equal to `NaN`, so the spliced block cannot be PROVEN to read back as what was asked for, even
      // though it does. Declining is the right answer to that: the guarantee is a proof, not a guess.
      expect(spliceMutated('a: 1\nb: 2\n', (frontmatter) => {
        frontmatter['a'] = NaN;
      })).toBeNull();
    });

    it('should produce a block that reads back as exactly the requested front matter', () => {
      expect(spliceMutated('title: Hello   # c\nnested:\n  deep: 0\nlist: [a, b]\n', (frontmatter) => {
        frontmatter['title'] = 'Changed';
        (frontmatter['nested'] as GenericObject)['deep'] = 1;
        (frontmatter['list'] as string[])[1] = 'c';
      })).toBe('title: Changed\nnested:\n  deep: 1\nlist: [a, c]\n');
    });
  });
});

/*
 * Each seed runs its full mutation count, which takes about a third of a second alone and crossed vitest's 5 s
 * default under a loaded `test:coverage` (measured 2026-09-24: 267-373 ms solo, a 5561 ms timeout under load). The
 * mutation count is the regression net, so the budget grows instead of the count shrinking.
 */
const DIFFERENTIAL_FUZZ_TEST_TIMEOUT_IN_MILLISECONDS = 30_000;

describe('the differential fuzz', { timeout: DIFFERENTIAL_FUZZ_TEST_TIMEOUT_IN_MILLISECONDS }, () => {
  const SEEDS = [1, 2];
  const ITERATIONS_PER_SEED = 500;
  const SEED_MULTIPLIER = 7919;
  // A textbook linear generator of the kind every runtime once shipped, so the sequence is this file's own rather
  // than the platform's, and a failure reproduces.
  const RANDOM_MODULUS = 4_294_967_296;
  const RANDOM_MULTIPLIER = 1_664_525;
  const RANDOM_INCREMENT = 1_013_904_223;
  const KEYS = ['title', 'tags', 'aliases', 'nested', 'list', 'count', 'flag', 'when', 'a', 'b', 'c', '42', 'with space'];
  const SCALARS = ['plain', 'has: colon', 'has # hash', '', 'multi\nline', 42, 0, -1, 3.5, true, false, null, 'yes', '2024-01-02'];

  function makeRandom(seed: number): () => number {
    let state = seed % RANDOM_MODULUS;
    return (): number => {
      state = (state * RANDOM_MULTIPLIER + RANDOM_INCREMENT) % RANDOM_MODULUS;
      return state / RANDOM_MODULUS;
    };
  }

  function pick<T>(rnd: () => number, values: readonly T[]): T {
    return castTo<T>(values[Math.floor(rnd() * values.length)]);
  }

  function randomValue(rnd: () => number, depth: number): unknown {
    const roll = rnd();
    if (depth >= 2 || roll < 0.55) {
      return pick(rnd, SCALARS);
    }

    return roll < 0.8 ? Array.from({ length: Math.floor(rnd() * 4) }, () => randomValue(rnd, depth + 1)) : randomMapping(rnd, depth + 1, Math.floor(rnd() * 3) + 1);
  }

  function randomMapping(rnd: () => number, depth: number, count: number): GenericObject {
    const mapping: GenericObject = {};
    for (let index = 0; index < count; index++) {
      mapping[pick(rnd, KEYS)] = randomValue(rnd, depth);
    }

    return mapping;
  }

  /**
  Decorates the emitted block with the formatting the engine exists to preserve.
  */
  function decorate(text: string, rnd: () => number): string {
    return text.split('\n').map((line) => {
      if (!line) {
        return line;
      }

      const roll = rnd();
      if (roll < 0.12) {
        return `${line}   # a comment`;
      }

      return roll < 0.2 ? `\n${line}` : line;
    }).join('\n');
  }

  function mutateValue(value: unknown, rnd: () => number, depth: number): unknown {
    if (!value || typeof value !== 'object' || value instanceof Date) {
      return pick(rnd, SCALARS);
    }

    return Array.isArray(value) ? mutateArray([...value] as unknown[], rnd, depth) : mutateMapping({ ...value }, rnd, depth);
  }

  function mutateArray(items: unknown[], rnd: () => number, depth: number): unknown[] {
    const roll = rnd();
    if (roll < 0.3 && items.length > 0) {
      items.splice(Math.floor(rnd() * items.length), 1);
    } else if (roll < 0.6) {
      items.push(pick(rnd, SCALARS));
    } else if (items.length > 0) {
      const at = Math.floor(rnd() * items.length);
      items[at] = mutateValue(items[at], rnd, depth + 1);
    }

    return items;
  }

  function mutateMapping(mapping: GenericObject, rnd: () => number, depth: number): GenericObject {
    const keys = Object.keys(mapping);
    const roll = rnd();
    if (roll < 0.25 && keys.length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Dropping a randomly chosen key is the point.
      delete mapping[pick(rnd, keys)];
    } else if (roll < 0.5) {
      mapping[pick(rnd, KEYS)] = randomValue(rnd, depth);
    } else if (roll < 0.7 && keys.length > 0) {
      const key = pick(rnd, keys);
      mapping[key] = mutateValue(mapping[key], rnd, depth + 1);
    } else if (keys.length > 1) {
      return Object.fromEntries(Object.entries(mapping).sort(([left], [right]) => left < right ? -1 : 1));
    }

    return mapping;
  }

  for (const seed of SEEDS) {
    // A seeded generator, so a failure is reproducible and a green run is not luck. The two invariants asserted here
    // are the whole safety argument: a preserved block reads back as exactly what the parse-and-stringify path would
    // have written, and a change that changes nothing changes no byte.
    it(`should never write a block that differs from the rewritten one, over seed ${String(seed)}`, () => {
      const rnd = makeRandom(seed * SEED_MULTIPLIER);
      let preservedCount = 0;

      for (let index = 0; index < ITERATIONS_PER_SEED; index++) {
        const keyCount = Math.floor(rnd() * 5) + 1;
        const note = makeNote(decorate(stringifyYaml(randomMapping(rnd, 0, keyCount)), rnd));
        const oldFrontmatter = parseFrontmatter(note);
        if (Object.keys(oldFrontmatter).length === 0) {
          continue;
        }

        // Parsed a second time rather than cloned, which is what `processFrontmatter()` itself does — and what keeps
        // the two projections built by the same code, so a difference between them is the engine's and nothing else's.
        const shouldLeaveAlone = rnd() < 0.2;
        const newFrontmatter = shouldLeaveAlone
          ? parseFrontmatter(note)
          : mutateMapping(parseFrontmatter(note), rnd, 0) as typeof oldFrontmatter;
        if (Object.keys(newFrontmatter).length === 0) {
          continue;
        }

        const preservedNote = preserveFrontmatterFormatting(note, newFrontmatter);
        if (preservedNote === null) {
          continue;
        }

        preservedCount++;
        expect(parseFrontmatter(preservedNote)).toStrictEqual(parseFrontmatter(setFrontmatter(note, newFrontmatter)));
        expect(preservedNote.endsWith(CLOSING_DELIMITER_AND_BODY)).toBe(true);

        // Only the untouched clone counts as a no-op: a mutation can be a pure REORDER, which is semantically equal
        // and is supposed to move bytes.
        if (shouldLeaveAlone) {
          expect(preservedNote).toBe(note);
        }
      }

      expect(preservedCount).toBeGreaterThan(ITERATIONS_PER_SEED / 2);
    });
  }
});

describe('enableFrontmatterFormattingPreservation', () => {
  afterEach(() => {
    registerFrontmatterFormattingPreserver(null);
  });

  it('should make `setFrontmatter` keep the formatting it would otherwise rewrite', () => {
    const content = makeNote('title: Hello   # a comment\ncount: 1\n');
    const newFrontmatter = parseFrontmatter(content);
    newFrontmatter['count'] = 2;
    expect(setFrontmatter(content, newFrontmatter)).not.toContain('# a comment');

    enableFrontmatterFormattingPreservation();
    expect(setFrontmatter(content, newFrontmatter)).toBe(makeNote('title: Hello   # a comment\ncount: 2\n'));
  });

  it('should leave `setFrontmatter` to write a block the engine declines', () => {
    const content = makeNote('anchored: &x 1\ncount: 1\n');
    const rewrittenContent = setFrontmatter(content, { anchored: 1, count: 2 });

    enableFrontmatterFormattingPreservation();
    expect(setFrontmatter(content, { anchored: 1, count: 2 })).toBe(rewrittenContent);
  });
});
