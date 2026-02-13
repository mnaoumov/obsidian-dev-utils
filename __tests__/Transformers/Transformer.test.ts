import {
  describe,
  expect,
  it
} from 'vitest';

import { Transformer } from '../../src/Transformers/Transformer.ts';

/**
 * A concrete test transformer that doubles numeric values.
 */
class DoubleTransformer extends Transformer {
  public override get id(): string {
    return 'double';
  }

  public override canTransform(value: unknown): boolean {
    return typeof value === 'number';
  }

  public override transformValue(value: unknown): unknown {
    return (value as number) * 2;
  }

  protected override restoreValue(transformedValue: unknown): unknown {
    return (transformedValue as number) / 2;
  }
}

describe('Transformer (via DoubleTransformer)', () => {
  const transformer = new DoubleTransformer();

  describe('id', () => {
    it('should return "double"', () => {
      expect(transformer.id).toBe('double');
    });
  });

  describe('canTransform', () => {
    it('should return true for numbers', () => {
      expect(transformer.canTransform(42)).toBe(true);
    });

    it('should return false for strings', () => {
      expect(transformer.canTransform('hello')).toBe(false);
    });

    it('should return false for objects', () => {
      expect(transformer.canTransform({})).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should double the number', () => {
      expect(transformer.transformValue(5)).toBe(10);
    });

    it('should handle zero', () => {
      expect(transformer.transformValue(0)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(transformer.transformValue(-3)).toBe(-6);
    });
  });

  describe('getTransformer', () => {
    it('should return self when id matches', () => {
      expect(transformer.getTransformer('double')).toBe(transformer);
    });

    it('should throw for non-matching id', () => {
      expect(() => transformer.getTransformer('other')).toThrow('Transformer with id other not found');
    });
  });

  describe('transformObjectRecursively', () => {
    it('should transform numeric values in a plain object', () => {
      const result = transformer.transformObjectRecursively({ a: 5, b: 10 });
      expect(result).toEqual({
        a: { __transformerId: 'double', transformedValue: 10 },
        b: { __transformerId: 'double', transformedValue: 20 }
      });
    });

    it('should leave non-numeric values untouched', () => {
      const result = transformer.transformObjectRecursively({ count: 3, name: 'test' });
      expect(result).toEqual({
        count: { __transformerId: 'double', transformedValue: 6 },
        name: 'test'
      });
    });

    it('should handle nested objects', () => {
      const result = transformer.transformObjectRecursively({
        outer: {
          inner: 7
        }
      });
      expect(result).toEqual({
        outer: {
          inner: { __transformerId: 'double', transformedValue: 14 }
        }
      });
    });

    it('should handle arrays within objects', () => {
      const result = transformer.transformObjectRecursively({ items: [1, 2, 3] });
      expect(result).toEqual({
        items: [
          { __transformerId: 'double', transformedValue: 2 },
          { __transformerId: 'double', transformedValue: 4 },
          { __transformerId: 'double', transformedValue: 6 }
        ]
      });
    });

    it('should handle arrays with mixed types', () => {
      const result = transformer.transformObjectRecursively({ items: [1, 'two', 3] });
      expect(result).toEqual({
        items: [
          { __transformerId: 'double', transformedValue: 2 },
          'two',
          { __transformerId: 'double', transformedValue: 6 }
        ]
      });
    });

    it('should restore wrapped values (objects with __transformerId)', () => {
      const wrapped = {
        value: {
          __transformerId: 'double',
          transformedValue: 20
        }
      };
      const result = transformer.transformObjectRecursively(wrapped);
      // The restoreValue divides by 2, so 20 -> 10
      expect(result['value']).toBe(10);
    });

    it('should restore and then potentially re-transform restored values if they are transformable', () => {
      // When transformObjectRecursively encounters a wrapper, it calls restoreValue
      // Which returns the raw restored value. The restored value is returned as-is
      // Because the recursive call happens at the wrapper level, not recursing into the result.
      const wrapped = {
        __transformerId: 'double',
        transformedValue: 100
      };
      const result = transformer.transformObjectRecursively(wrapped);
      // The wrapper is at the top level, so restoreValue is called: 100 / 2 = 50
      expect(result).toBe(50);
    });

    it('should handle null values in objects', () => {
      const result = transformer.transformObjectRecursively({ a: null, b: 5 });
      expect(result).toEqual({
        a: null,
        b: { __transformerId: 'double', transformedValue: 10 }
      });
    });

    it('should handle deeply nested structures', () => {
      const result = transformer.transformObjectRecursively({
        level1: {
          level2: {
            level3: {
              value: 4
            }
          }
        }
      });
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: { __transformerId: 'double', transformedValue: 8 }
            }
          }
        }
      });
    });

    it('should handle empty objects', () => {
      const result = transformer.transformObjectRecursively({});
      expect(result).toEqual({});
    });

    it('should handle empty arrays in objects', () => {
      const result = transformer.transformObjectRecursively({ items: [] });
      expect(result).toEqual({ items: [] });
    });
  });
});
