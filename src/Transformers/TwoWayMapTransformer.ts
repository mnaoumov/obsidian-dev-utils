/**
 * @packageDocumentation
 *
 * A transformer that can transform a TwoWayMap to an array of entries and back.
 */

import { TwoWayMap } from '../TwoWayMap.ts';
import { TypedTransformer } from './TypedTransformer.ts';

type MapEntry = readonly [key: unknown, value: unknown];

/**
 * A transformer that can transform a TwoWayMap to an array of entries and back.
 */
export class TwoWayMapTransformer extends TypedTransformer<TwoWayMap<unknown, unknown>, MapEntry[]> {
  /**
   * Gets the ID of the transformer.
   *
   * @returns The ID of the transformer.
   */
  public override get id(): string {
    return 'two-way-map';
  }

  /**
   * Checks if the value is a TwoWayMap.
   *
   * @param value - The value to check.
   * @returns True if the value is a TwoWayMap, false otherwise.
   */
  public override canTransform(value: unknown): value is TwoWayMap<unknown, unknown> {
    return value instanceof TwoWayMap;
  }

  /**
   * Restores a TwoWayMap from an array of entries.
   *
   * @param transformedValue - The array of entries.
   * @returns The TwoWayMap.
   */
  public override restoreValue(transformedValue: MapEntry[]): TwoWayMap<unknown, unknown> {
    return new TwoWayMap<unknown, unknown>(transformedValue);
  }

  /**
   * Transforms a TwoWayMap to an array of entries.
   *
   * @param value - The TwoWayMap.
   * @returns The array of entries.
   */
  public override transformValue(value: TwoWayMap<unknown, unknown>): MapEntry[] {
    return Array.from(value.entries());
  }
}
