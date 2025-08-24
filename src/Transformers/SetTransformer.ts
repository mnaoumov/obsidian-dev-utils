/**
 * @packageDocumentation
 *
 * A transformer that can transform a Set to an array and back.
 */

import { TypedTransformer } from './TypedTransformer.ts';

/**
 * A transformer that can transform a Set to an array and back.
 */
export class SetTransformer extends TypedTransformer<Set<unknown>, unknown[]> {
  /**
   * An id of the transformer.
   *
   * @returns The ID of the transformer.
   */
  public override get id(): string {
    return 'set';
  }

  /**
   * Checks if the value is a Set.
   *
   * @param value - The value to check.
   * @returns True if the value is a Set, false otherwise.
   */
  public override canTransform(value: unknown): value is Set<unknown> {
    return value instanceof Set;
  }

  /**
   * Restores the value from an array.
   *
   * @param transformedValue - The array to restore the value from.
   * @returns The restored value.
   */
  public override restoreValue(transformedValue: unknown[]): Set<unknown> {
    return new Set(transformedValue);
  }

  /**
   * Transforms the value to an array.
   *
   * @param value - The value to transform.
   * @returns The transformed value.
   */
  public override transformValue(value: Set<unknown>): unknown[] {
    return Array.from(value);
  }
}
