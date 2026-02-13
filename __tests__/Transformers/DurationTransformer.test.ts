import { moment } from 'obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import { DurationTransformer } from '../../src/Transformers/DurationTransformer.ts';

describe('DurationTransformer', () => {
  const transformer = new DurationTransformer();

  describe('id', () => {
    it('should return "duration"', () => {
      expect(transformer.id).toBe('duration');
    });
  });

  describe('canTransform', () => {
    it('should return true for a moment.Duration', () => {
      const duration = moment.duration(1, 'hour');
      expect(transformer.canTransform(duration)).toBe(true);
    });

    it('should return false for a number', () => {
      expect(transformer.canTransform(42)).toBe(false);
    });

    it('should return false for a string', () => {
      expect(transformer.canTransform('PT1H')).toBe(false);
    });

    it('should return false for null', () => {
      expect(transformer.canTransform(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(transformer.canTransform(undefined)).toBe(false);
    });

    it('should return false for a plain object', () => {
      expect(transformer.canTransform({})).toBe(false);
    });
  });

  describe('transformValue', () => {
    it('should convert a duration to an ISO string', () => {
      const duration = moment.duration(1, 'hour');
      const result = transformer.transformValue(duration);
      expect(result).toBe('PT1H');
    });

    it('should convert a multi-unit duration to an ISO string', () => {
      const duration = moment.duration({ hours: 2, minutes: 30 });
      const result = transformer.transformValue(duration);
      expect(result).toBe('PT2H30M');
    });

    it('should handle zero duration', () => {
      const duration = moment.duration(0);
      const result = transformer.transformValue(duration);
      expect(result).toBe('P0D');
    });
  });

  describe('restoreValue', () => {
    it('should restore a duration from an ISO string', () => {
      const restored = transformer.restoreValue('PT1H');
      expect(restored.asHours()).toBe(1);
    });

    it('should restore a multi-unit duration', () => {
      const restored = transformer.restoreValue('PT2H30M');
      expect(restored.asMinutes()).toBe(150);
    });

    it('should round-trip a duration through transform and restore', () => {
      const original = moment.duration(90, 'minutes');
      const iso = transformer.transformValue(original);
      const restored = transformer.restoreValue(iso);
      expect(restored.asMinutes()).toBe(original.asMinutes());
    });
  });

  describe('transformObjectRecursively', () => {
    it('should transform duration values in an object', () => {
      const duration = moment.duration(1, 'hour');
      const result = transformer.transformObjectRecursively({ time: duration });
      expect(result).toEqual({
        time: { __transformerId: 'duration', transformedValue: 'PT1H' }
      });
    });

    it('should restore wrapped duration values', () => {
      const wrapped = {
        time: {
          __transformerId: 'duration',
          transformedValue: 'PT1H'
        }
      };
      const result = transformer.transformObjectRecursively(wrapped) as { time: moment.Duration };
      expect(result.time.asHours()).toBe(1);
    });
  });
});
