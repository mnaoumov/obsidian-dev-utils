import {
  describe,
  expect,
  it
} from 'vitest';

import { DateTransformer } from '../../src/Transformers/DateTransformer.ts';
import { GroupTransformer } from '../../src/Transformers/GroupTransformer.ts';
import { MapTransformer } from '../../src/Transformers/MapTransformer.ts';
import type { Transformer } from '../../src/Transformers/Transformer.ts';

/**
 * Exposes the protected restoreValue method for testing purposes.
 */
class TestableGroupTransformer extends GroupTransformer {
  public constructor(transformers: Transformer[]) {
    super(transformers);
  }

  public callRestoreValue(): unknown {
    return this.restoreValue();
  }
}

describe('GroupTransformer', () => {
  const dateTransformer = new DateTransformer();
  const mapTransformer = new MapTransformer();
  const group = new TestableGroupTransformer([dateTransformer, mapTransformer]);

  describe('id', () => {
    it('should return "group"', () => {
      expect(group.id).toBe('group');
    });
  });

  describe('canTransform', () => {
    it.each([
      { description: 'a Date', value: new Date() },
      { description: 'a Map', value: new Map() }
    ])('should return true for $description', ({ value }) => {
      expect(group.canTransform(value, '')).toBe(true);
    });

    it.each([
      { description: 'a string', value: 'a string' },
      { description: 'a number', value: 42 },
      { description: 'a plain object', value: {} },
      { description: 'null', value: null }
    ])('should return false for $description', ({ value }) => {
      expect(group.canTransform(value, '')).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should delegate Date transformation to DateTransformer', () => {
      const date = new Date('2024-06-15T12:00:00.000Z');
      const result = group.transformValue(date, '');
      expect(result).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should delegate Map transformation to MapTransformer', () => {
      const map = new Map([['a', 1]]);
      const result = group.transformValue(map, '');
      expect(result).toEqual([['a', 1]]);
    });

    it('should throw when no transformer can handle the value', () => {
      expect(() => group.transformValue('string', '')).toThrow('No transformer can transform the value');
    });
  });

  describe('getTransformer', () => {
    it('should find child transformer by id "date"', () => {
      const found = group.getTransformer('date');
      expect(found).toBe(dateTransformer);
    });

    it('should find child transformer by id "map"', () => {
      const found = group.getTransformer('map');
      expect(found).toBe(mapTransformer);
    });

    it('should throw for unknown transformer id', () => {
      expect(() => group.getTransformer('unknown')).toThrow('No transformer with id unknown found');
    });
  });

  describe('restoreValue', () => {
    it('should throw an Error', () => {
      expect(() => {
        group.callRestoreValue();
      }).toThrow('GroupTransformer does not support restoring values');
    });
  });

  describe('transformObjectRecursively', () => {
    it('should transform Date values in an object using the group', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = group.transformObjectRecursively({ createdAt: date });
      expect(result).toEqual({
        createdAt: {
          __transformerId: 'date',
          transformedValue: '2024-01-01T00:00:00.000Z'
        }
      });
    });

    it('should transform Map values in an object using the group', () => {
      const map = new Map([['key', 'val']]);
      const result = group.transformObjectRecursively({ data: map });
      expect(result).toEqual({
        data: {
          __transformerId: 'map',
          transformedValue: [['key', 'val']]
        }
      });
    });

    describe('should restore wrapped Date values when encountered', () => {
      const wrapped = {
        createdAt: {
          __transformerId: 'date',
          transformedValue: '2024-01-01T00:00:00.000Z'
        }
      };
      const result = group.transformObjectRecursively(wrapped);

      it('should restore to a Date instance', () => {
        expect(result['createdAt']).toBeInstanceOf(Date);
      });

      it('should restore the correct ISO string', () => {
        expect((result['createdAt'] as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z');
      });
    });
  });
});
