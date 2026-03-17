/**
 * @packageDocumentation
 *
 * Helper to define properties on mock prototypes without overriding
 * existing properties. This prevents accidentally clobbering properties
 * that `obsidian-test-mocks` already defines.
 */

/**
 * Defines a property on `target` only if it does not already exist.
 *
 * @param target - The prototype or object to patch.
 * @param property - The property name to define.
 * @param descriptor - The property descriptor.
 */
export function defineMissingProperty(target: object, property: string, descriptor: PropertyDescriptor): void {
  if (property in target) {
    return;
  }

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable: true,
    ...descriptor
  });
}
