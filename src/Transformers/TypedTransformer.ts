/**
 * @packageDocumentation
 *
 * A base class for transformers that can transform and restore a specific type.
 */

import { Transformer } from './Transformer.ts';

/**
 * A transformer that can transform and restore a specific type.
 *
 * @typeParam Source - The type of the source value.
 * @typeParam Transformed - The type of the transformed value.
 */
export abstract class TypedTransformer<Source, Transformed> extends Transformer {
  /**
   * Determines if the transformer can transform the given value.
   *
   * @param value - The value to check.
   * @param key - The key of the value to check.
   * @returns A boolean indicating if the transformer can transform the value.
   */
  public abstract override canTransform(value: unknown, key: string): value is Source;

  /**
   * Restores the given value.
   *
   * @param transformedValue - The value to restore.
   * @param key - The key of the value to restore.
   * @returns The restored value.
   */
  public abstract override restoreValue(transformedValue: Transformed, key: string): Source;

  /**
   * Transforms the given value.
   *
   * @param value - The value to transform.
   * @param key - The key of the value to transform.
   * @returns The transformed value.
   */
  public abstract override transformValue(value: Source, key: string): Transformed;
}
