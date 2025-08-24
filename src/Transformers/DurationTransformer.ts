/**
 * @packageDocumentation
 *
 * A transformer that can transform Duration to an ISO string and back.
 */

import type { Duration } from 'moment';

import { duration } from 'moment';

import { TypedTransformer } from './TypedTransformer.ts';

/**
 * A transformer that converts a Duration to an ISO string and back.
 */
export class DurationTransformer extends TypedTransformer<Duration, string> {
  /**
   * An id of the transformer.
   *
   * @returns The id of the transformer.
   */
  public override get id(): string {
    return 'duration';
  }

  /**
   * Checks if the value is a Duration.
   *
   * @param value - The value to check.
   * @returns True if the value is a Duration, false otherwise.
   */
  public override canTransform(value: unknown): value is Duration {
    const maybeDuration = (value ?? {}) as Partial<Duration>;
    return !!maybeDuration.asHours && !!maybeDuration.asMinutes && !!maybeDuration.asSeconds && !!maybeDuration.asMilliseconds;
  }

  /**
   * Restores the value from a string.
   *
   * @param transformedValue - The string to restore the value from.
   * @returns The restored value.
   */
  public override restoreValue(transformedValue: string): Duration {
    return duration(transformedValue);
  }

  /**
   * Transforms the value to a string.
   *
   * @param value - The value to transform.
   * @returns The transformed value.
   */
  public override transformValue(value: Duration): string {
    return value.toISOString();
  }
}
