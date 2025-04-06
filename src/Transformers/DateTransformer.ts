/**
 * @packageDocumentation
 *
 * A transformer that can transform Date to an ISO string and back.
 */

import { TypedTransformer } from './TypedTransformer.ts';

/**
 * A transformer that can transform Date to an ISO string and back.
 */
export class DateTransformer extends TypedTransformer<Date, string> {
  /**
   * The id of the transformer.
   *
   * @returns `date`.
   */
  public override get id(): string {
    return 'date';
  }

  /**
   * Determines if the value is a Date.
   *
   * @param value - The value to check.
   * @returns A boolean indicating if the value is a Date.
   */
  public override canTransform(value: unknown): value is Date {
    return value instanceof Date;
  }

  /**
   * Restores the value from a string.
   *
   * @param transformedValue - The transformed value.
   * @returns The restored value.
   */
  public override restoreValue(transformedValue: string): Date {
    return new Date(transformedValue);
  }

  /**
   * Transforms the value to a string.
   *
   * @param value - The value to transform.
   * @returns The transformed value.
   */
  public override transformValue(value: Date): string {
    return value.toISOString();
  }
}
