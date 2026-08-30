// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import type { GenericObject } from '../type-guards.ts';

import {
  parseFrontmatter,
  removeEmptyFrontmatterValues,
  setFrontmatter
} from './frontmatter.ts';

describe('parseFrontmatter', () => {
  it('should parse simple key-value frontmatter', () => {
    const content = '---\ntitle: My Note\n---\nBody text';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('title', 'My Note');
  });

  describe('should parse multiple frontmatter properties', () => {
    const content = '---\ntitle: Test\nauthor: Alice\n---\nBody';
    const result = parseFrontmatter(content);

    it('should parse the title property', () => {
      expect(result).toHaveProperty('title', 'Test');
    });

    it('should parse the author property', () => {
      expect(result).toHaveProperty('author', 'Alice');
    });
  });

  it('should parse numeric frontmatter values', () => {
    const content = '---\ncount: 42\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('count', 42);
  });

  it('should parse boolean frontmatter values', () => {
    const content = '---\npublish: true\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('publish', true);
  });

  it('should return an empty object when there is no frontmatter', () => {
    const content = 'No frontmatter here';
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });

  it('should return an empty object when frontmatter is empty', () => {
    const content = '---\n\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });
});

describe('setFrontmatter', () => {
  describe('should add frontmatter to content without existing frontmatter', () => {
    const content = 'Body text';
    const result = setFrontmatter(content, { title: 'New' });

    it('should include frontmatter delimiters', () => {
      expect(result).toContain('---\n');
    });

    it('should include the title property', () => {
      expect(result).toContain('title: New');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  describe('should prepend frontmatter delimiters when adding new frontmatter', () => {
    const content = 'Some body content';
    const result = setFrontmatter(content, { key: 'value' });

    it('should start with frontmatter delimiters', () => {
      expect(result.startsWith('---\n')).toBe(true);
    });

    it('should contain frontmatter delimiters', () => {
      expect(result).toContain('---\n');
    });

    it('should end with the original body content', () => {
      expect(result.endsWith('Some body content')).toBe(true);
    });
  });

  describe('should replace existing frontmatter with new frontmatter', () => {
    const content = '---\ntitle: Old\n---\nBody text';
    const result = setFrontmatter(content, { title: 'New' });

    it('should contain the new title', () => {
      expect(result).toContain('title: New');
    });

    it('should not contain the old title', () => {
      expect(result).not.toContain('title: Old');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  describe('should remove frontmatter when new frontmatter is empty', () => {
    const content = '---\ntitle: Remove Me\n---\nBody text';
    const result = setFrontmatter(content, {});

    it('should not contain frontmatter delimiters', () => {
      expect(result).not.toContain('---');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  it('should return just the body when removing frontmatter from content that has it', () => {
    const content = '---\ntitle: Test\n---\nBody only';
    const result = setFrontmatter(content, {});
    expect(result).toBe('Body only');
  });

  it('should return empty string when removing frontmatter and there is no body', () => {
    const content = 'No frontmatter, just text';
    const result = setFrontmatter(content, {});
    expect(result).toBe('No frontmatter, just text');
  });

  describe('should handle setting frontmatter with multiple properties', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { author: 'Bob', title: 'Test' });

    it('should contain the title property', () => {
      expect(result).toContain('title: Test');
    });

    it('should contain the author property', () => {
      expect(result).toContain('author: Bob');
    });

    it('should preserve the body', () => {
      expect(result).toContain('Body');
    });
  });

  it('should handle boolean values in new frontmatter', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { publish: true });
    expect(result).toContain('publish: true');
  });

  it('should handle numeric values in new frontmatter', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { order: 5 });
    expect(result).toContain('order: 5');
  });
});

describe('removeEmptyFrontmatterValues', () => {
  describe('default policy', () => {
    it('should remove an empty string value at the top level', () => {
      const frontmatter: GenericObject = { keep: 'value', remove: '' };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ keep: 'value' });
      expect(removedKeyPaths).toEqual(['remove']);
    });

    it('should remove an empty string value nested in an object', () => {
      const frontmatter: GenericObject = { outer: { inner: { keep: 'value', remove: '' } } };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ outer: { inner: { keep: 'value' } } });
      expect(removedKeyPaths).toEqual(['outer.inner.remove']);
    });

    it('should remove empty string items from an array', () => {
      const frontmatter: GenericObject = { tags: ['', 'a', '', 'b'] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ tags: ['a', 'b'] });
      expect(removedKeyPaths).toEqual(['tags.0', 'tags.2']);
    });

    it('should remove an empty string value nested in an object inside an array', () => {
      const frontmatter: GenericObject = { rows: [{ keep: 'value', remove: '' }] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ rows: [{ keep: 'value' }] });
      expect(removedKeyPaths).toEqual(['rows.0.remove']);
    });

    describe('should compact an array nested inside an array instead of leaving a hole', () => {
      const frontmatter: GenericObject = { matrix: [['', 'a'], ['b']] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });

      it('should compact the inner array', () => {
        expect(frontmatter).toEqual({ matrix: [['a'], ['b']] });
      });

      it('should not leave a hole in the inner array', () => {
        expect((frontmatter['matrix'] as string[][])[0]).toHaveLength(1);
      });

      it('should report the removed key path', () => {
        expect(removedKeyPaths).toEqual(['matrix.0.0']);
      });
    });

    it('should keep `null` and `undefined` values', () => {
      const frontmatter: GenericObject = { nothing: null, unset: undefined };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ nothing: null, unset: undefined });
      expect(removedKeyPaths).toEqual([]);
    });

    it('should keep empty arrays and empty objects', () => {
      const frontmatter: GenericObject = { emptyArray: [], emptyObject: {} };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ emptyArray: [], emptyObject: {} });
      expect(removedKeyPaths).toEqual([]);
    });

    it('should keep falsy values that are not empty strings', () => {
      const frontmatter: GenericObject = { count: 0, flag: false };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ count: 0, flag: false });
      expect(removedKeyPaths).toEqual([]);
    });

    it('should keep an array that is empty only after its items were removed', () => {
      const frontmatter: GenericObject = { tags: [''] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ tags: [] });
      expect(removedKeyPaths).toEqual(['tags.0']);
    });

    it('should keep an object that is empty only after its properties were removed', () => {
      const frontmatter: GenericObject = { outer: { remove: '' } };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
      expect(frontmatter).toEqual({ outer: {} });
      expect(removedKeyPaths).toEqual(['outer.remove']);
    });
  });

  describe('shouldRemoveNulls', () => {
    it('should remove `null` and `undefined` values when enabled', () => {
      const frontmatter: GenericObject = { keep: 'value', nothing: null, unset: undefined };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveNulls: true });
      expect(frontmatter).toEqual({ keep: 'value' });
      expect(removedKeyPaths).toEqual(['nothing', 'unset']);
    });

    it('should remove `null` array items when enabled', () => {
      const frontmatter: GenericObject = { tags: [null, 'a'] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveNulls: true });
      expect(frontmatter).toEqual({ tags: ['a'] });
      expect(removedKeyPaths).toEqual(['tags.0']);
    });
  });

  describe('shouldRemoveEmptyArrays', () => {
    it('should remove an array that was already empty when enabled', () => {
      const frontmatter: GenericObject = { emptyArray: [] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyArrays: true });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual(['emptyArray']);
    });

    it('should remove an array that became empty after its items were removed', () => {
      const frontmatter: GenericObject = { tags: ['', ''] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyArrays: true });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual(['tags.0', 'tags.1', 'tags']);
    });

    it('should not remove an empty object when only empty arrays are enabled', () => {
      const frontmatter: GenericObject = { emptyObject: {} };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyArrays: true });
      expect(frontmatter).toEqual({ emptyObject: {} });
      expect(removedKeyPaths).toEqual([]);
    });
  });

  describe('shouldRemoveEmptyObjects', () => {
    it('should remove an object that was already empty when enabled', () => {
      const frontmatter: GenericObject = { emptyObject: {} };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyObjects: true });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual(['emptyObject']);
    });

    it('should remove an object that became empty after its properties were removed', () => {
      const frontmatter: GenericObject = { outer: { inner: '' } };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyObjects: true });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual(['outer.inner', 'outer']);
    });

    it('should not remove an empty array when only empty objects are enabled', () => {
      const frontmatter: GenericObject = { emptyArray: [] };
      const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter, shouldRemoveEmptyObjects: true });
      expect(frontmatter).toEqual({ emptyArray: [] });
      expect(removedKeyPaths).toEqual([]);
    });
  });

  describe('every flag enabled', () => {
    it('should collapse a deeply nested structure that holds nothing but empty values', () => {
      const frontmatter: GenericObject = { outer: { list: ['', null], nested: { deep: undefined } } };
      const removedKeyPaths = removeEmptyFrontmatterValues({
        frontmatter,
        shouldRemoveEmptyArrays: true,
        shouldRemoveEmptyObjects: true,
        shouldRemoveNulls: true
      });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual(['outer.list.0', 'outer.list.1', 'outer.list', 'outer.nested.deep', 'outer.nested', 'outer']);
    });

    it('should keep a `Date` value', () => {
      const date = new Date('2026-08-30T00:00:00.000Z');
      const frontmatter: GenericObject = { created: date };
      const removedKeyPaths = removeEmptyFrontmatterValues({
        frontmatter,
        shouldRemoveEmptyArrays: true,
        shouldRemoveEmptyObjects: true,
        shouldRemoveNulls: true
      });
      expect(frontmatter).toEqual({ created: date });
      expect(removedKeyPaths).toEqual([]);
    });

    it('should keep a `Date` array item', () => {
      const date = new Date('2026-08-30T00:00:00.000Z');
      const frontmatter: GenericObject = { dates: [date] };
      const removedKeyPaths = removeEmptyFrontmatterValues({
        frontmatter,
        shouldRemoveEmptyArrays: true,
        shouldRemoveEmptyObjects: true,
        shouldRemoveNulls: true
      });
      expect(frontmatter).toEqual({ dates: [date] });
      expect(removedKeyPaths).toEqual([]);
    });

    it('should leave the root object itself in place when it becomes empty', () => {
      const frontmatter: GenericObject = {};
      const removedKeyPaths = removeEmptyFrontmatterValues({
        frontmatter,
        shouldRemoveEmptyArrays: true,
        shouldRemoveEmptyObjects: true,
        shouldRemoveNulls: true
      });
      expect(frontmatter).toEqual({});
      expect(removedKeyPaths).toEqual([]);
    });
  });

  it('should report original array indices across multiple removals', () => {
    const frontmatter: GenericObject = { tags: ['', 'a', '', '', 'b'] };
    const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
    expect(frontmatter).toEqual({ tags: ['a', 'b'] });
    expect(removedKeyPaths).toEqual(['tags.0', 'tags.2', 'tags.3']);
  });

  it('should return an empty array and leave the object untouched when there is nothing to remove', () => {
    const frontmatter: GenericObject = { count: 42, nested: { list: ['a'] }, title: 'Test' };
    const removedKeyPaths = removeEmptyFrontmatterValues({ frontmatter });
    expect(frontmatter).toEqual({ count: 42, nested: { list: ['a'] }, title: 'Test' });
    expect(removedKeyPaths).toEqual([]);
  });
});
