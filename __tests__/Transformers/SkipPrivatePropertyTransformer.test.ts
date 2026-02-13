import {
  describe,
  expect,
  it
} from 'vitest';

import { SkipPrivatePropertyTransformer } from '../../src/Transformers/SkipPrivatePropertyTransformer.ts';

describe('SkipPrivatePropertyTransformer', () => {
  const transformer = new SkipPrivatePropertyTransformer();

  describe('id', () => {
    it('should return "skip-private-property"', () => {
      expect(transformer.id).toBe('skip-private-property');
    });
  });

  describe('canTransform', () => {
    it('should return true for keys starting with underscore', () => {
      expect(transformer.canTransform('any value', '_private')).toBe(true);
    });

    it('should return true for keys with only underscores', () => {
      expect(transformer.canTransform(null, '___')).toBe(true);
    });

    it('should return true for single underscore key', () => {
      expect(transformer.canTransform(42, '_')).toBe(true);
    });

    it('should return true for double underscore key', () => {
      expect(transformer.canTransform({}, '__internal')).toBe(true);
    });

    it('should return false for keys not starting with underscore', () => {
      expect(transformer.canTransform('value', 'publicProp')).toBe(false);
    });

    it('should return false for empty key', () => {
      expect(transformer.canTransform('value', '')).toBe(false);
    });

    it('should return false for keys with underscore in the middle', () => {
      expect(transformer.canTransform('value', 'some_prop')).toBe(false);
    });

    it('should return false for keys ending with underscore', () => {
      expect(transformer.canTransform('value', 'prop_')).toBe(false);
    });

    it('should not depend on the value at all', () => {
      expect(transformer.canTransform(undefined, '_key')).toBe(true);
      expect(transformer.canTransform(null, '_key')).toBe(true);
      expect(transformer.canTransform(0, '_key')).toBe(true);
      expect(transformer.canTransform('', '_key')).toBe(true);
    });
  });

  describe('transformValue', () => {
    it('should return undefined', () => {
      expect(transformer.transformValue()).toBeUndefined();
    });

    it('should return undefined regardless of input', () => {
      expect(transformer.transformValue()).toBeUndefined();
      expect(transformer.transformValue()).toBeUndefined();
    });
  });

  describe('restoreValue', () => {
    it('should throw an Error', () => {
      expect(() => {
        // RestoreValue is protected, but we can test it through the transformer's
        // Recursive restore mechanism by constructing a wrapper object
        // For direct testing, we use the getTransformer + restore path
        const t = transformer.getTransformer('skip-private-property');
        // Access restoreValue indirectly via transformObjectRecursively with a wrapper
        t.transformObjectRecursively({
          __transformerId: 'skip-private-property',
          transformedValue: 'anything'
        });
      }).toThrow('SkipPrivatePropertyTransformer does not support restoring values');
    });
  });
});
