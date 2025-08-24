/**
 * @packageDocumentation
 *
 * A base class for transformers.
 */

import type { GenericObject } from '../ObjectUtils.ts';

import { getAllKeys } from '../ObjectUtils.ts';

/**
 * A wrapper for a transformed value.
 */
interface TransformedValueWrapper {
  /**
   * An id of the transformer that transformed the value.
   */
  __transformerId: string;

  /**
   * A transformed value.
   */
  transformedValue: unknown;
}

/**
 * A base class for transformers.
 */
export abstract class Transformer {
  /**
   * An id of the transformer.
   */
  public abstract get id(): string;

  /**
   * Determines if the transformer can transform the given value.
   *
   * @param value - The value to check.
   * @param key - The key of the value to check.
   * @returns A boolean indicating if the transformer can transform the value.
   */
  public abstract canTransform(value: unknown, key: string): boolean;

  /**
   * Gets the transformer with the given id.
   *
   * @param transformerId - The id of the transformer to get.
   * @returns The transformer with the given id.
   */
  // eslint-disable-next-line @typescript-eslint/prefer-return-this-type
  public getTransformer(transformerId: string): Transformer {
    if (transformerId === this.id) {
      return this;
    }

    throw new Error(`Transformer with id ${transformerId} not found`);
  }

  /**
   * Transforms the given object recursively.
   *
   * @param value - The value to transform.
   * @returns The transformed value.
   */
  public transformObjectRecursively(value: object): GenericObject {
    return this.transformValueRecursively(value, '') as GenericObject;
  }

  /**
   * Transforms the given value.
   *
   * @param value - The value to transform.
   * @param key - The key of the value to transform.
   * @returns The transformed value.
   */
  public abstract transformValue(value: unknown, key: string): unknown;

  /**
   * Gets the id of the transformer that can transform the given value.
   *
   * @param value - The value to get the transformer id for.
   * @param key - The key of the value to get the transformer id for.
   * @returns The id of the transformer that can transform the given value.
   */
  protected getTransformerId(value: unknown, key: string): null | string {
    if (this.canTransform(value, key)) {
      return this.id;
    }

    return null;
  }

  /**
   * Restores the given value.
   *
   * @param transformedValue - The value to restore.
   * @param key - The key of the value to restore.
   * @returns The restored value.
   */
  protected abstract restoreValue(transformedValue: unknown, key: string): unknown;

  /**
   * Transforms the given value recursively.
   *
   * @param value - The value to transform.
   * @param key - The key of the value to transform.
   * @returns The transformed value.
   */
  private transformValueRecursively(value: unknown, key: string): unknown {
    const transformerId = this.getTransformerId(value, key);
    if (transformerId) {
      const transformedValue = this.transformValue(value, key);
      if (transformedValue === undefined) {
        return undefined;
      }

      const wrapper: TransformedValueWrapper = {
        __transformerId: transformerId,
        transformedValue
      };

      return wrapper;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((childValue, index) => this.transformValueRecursively(childValue, String(index)));
    }

    const transformedValueWrapper = value as Partial<TransformedValueWrapper>;
    if (transformedValueWrapper.__transformerId) {
      return this.getTransformer(transformedValueWrapper.__transformerId).restoreValue(transformedValueWrapper.transformedValue, key);
    }

    const record: GenericObject = {};

    for (const childKey of getAllKeys(value)) {
      const childValue = value[childKey];
      const transformedChildValue = this.transformValueRecursively(childValue, childKey);
      record[childKey] = transformedChildValue;
    }

    return record;
  }
}
