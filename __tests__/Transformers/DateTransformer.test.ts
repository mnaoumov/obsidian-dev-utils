import {
  describe,
  expect,
  it
} from 'vitest';

import { DateTransformer } from '../../src/Transformers/DateTransformer.ts';

describe('DateTransformer', () => {
  const transformer = new DateTransformer();

  describe('id', () => {
    it('should return "date"', () => {
      expect(transformer.id).toBe('date');
    });
  });

  describe('canTransform', () => {
    it.each([
      { description: 'Date instance', value: new Date() },
      { description: 'Date with specific time', value: new Date('2024-06-15T12:00:00Z') }
    ])('should return true for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(true);
    });

    it.each([
      { description: 'a string', value: '2024-01-01' },
      { description: 'a number', value: 1234567890 },
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'a plain object', value: {} }
    ])('should return false for $description', ({ value }) => {
      expect(transformer.canTransform(value)).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should convert a Date to an ISO string', () => {
      const date = new Date('2024-06-15T12:30:45.123Z');
      expect(transformer.transformValue(date)).toBe('2024-06-15T12:30:45.123Z');
    });

    it('should convert epoch Date to an ISO string', () => {
      const date = new Date(0);
      expect(transformer.transformValue(date)).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('restoreValue', () => {
    it('should convert an ISO string back to a Date instance', () => {
      const isoString = '2024-06-15T12:30:45.123Z';
      const result = transformer.restoreValue(isoString);
      expect(result).toBeInstanceOf(Date);
    });

    it('should convert an ISO string back to a Date with the correct value', () => {
      const isoString = '2024-06-15T12:30:45.123Z';
      const result = transformer.restoreValue(isoString);
      expect(result.toISOString()).toBe(isoString);
    });

    it('should restore epoch date', () => {
      const result = transformer.restoreValue('1970-01-01T00:00:00.000Z');
      expect(result.getTime()).toBe(0);
    });
  });

  describe('round-trip', () => {
    it('should preserve the date through transform and restore', () => {
      const original = new Date('2024-12-25T08:00:00.000Z');
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.getTime()).toBe(original.getTime());
    });

    it('should preserve millisecond precision', () => {
      const original = new Date('2024-03-14T15:09:26.535Z');
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.toISOString()).toBe(original.toISOString());
    });

    it.each([
      { description: 'Y2K', iso: '2000-01-01T00:00:00.000Z' },
      { description: 'end of 1999', iso: '1999-12-31T23:59:59.999Z' },
      { description: 'year 2100', iso: '2100-06-15T12:00:00.000Z' },
      { description: 'epoch', iso: '1970-01-01T00:00:00.000Z' }
    ])('should preserve $description date through round-trip', ({ iso }) => {
      const original = new Date(iso);
      const transformed = transformer.transformValue(original);
      const restored = transformer.restoreValue(transformed);
      expect(restored.getTime()).toBe(original.getTime());
    });
  });
});
