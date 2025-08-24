/**
 * @packageDocumentation
 *
 * A transformer that can transform a Map to an array of entries and back.
 */

import { TypedTransformer } from './TypedTransformer.ts';

type MapEntry = readonly [key: unknown, value: unknown];

/**
 * A transformer that can transform a Map to an array of entries and back.
 */
export class MapTransformer extends TypedTransformer<Map<unknown, unknown>, MapEntry[]> {
  /**
   * An id of the transformer.
   *
   * @returns The ID of the transformer.
   */
  public override get id(): string {
    return 'map';
  }

  /**
   * Checks if the value is a Map.
   *
   * @param value - The value to check.
   * @returns True if the value is a Map, false otherwise.
   */
  public override canTransform(value: unknown): value is Map<unknown, unknown> {
    return value instanceof Map;
  }

  /**
   * Restores the value from an array of entries.
   *
   * @param transformedValue - The array of entries to restore the value from.
   * @returns The restored value.
   */
  public override restoreValue(transformedValue: MapEntry[]): Map<unknown, unknown> {
    return new Map<unknown, unknown>(transformedValue);
  }

  /**
   * Transforms the value to an array of entries.
   *
   * @param value - The value to transform.
   * @returns The transformed value.
   */
  public override transformValue(value: Map<unknown, unknown>): MapEntry[] {
    return Array.from(value.entries());
  }
}
