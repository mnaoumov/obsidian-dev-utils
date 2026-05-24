/**
 * @file
 *
 * Tests for {@link RegistryComponent}.
 */

import {
  describe,
  expect,
  it
} from 'vitest';

import { ComponentEx } from './component-ex.ts';
import { RegistryComponent } from './registry-component.ts';

// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Testing RegistryComponent.
class ChildA extends ComponentEx {}

// eslint-disable-next-line obsidian-dev-utils/require-component-suffix -- Testing RegistryComponent.
class ChildB extends ComponentEx {}

describe('RegistryComponent', () => {
  describe('getChild', () => {
    it('should return the single child of the given type', () => {
      const registry = new RegistryComponent();
      const childA = new ChildA();
      registry.addChild(childA);

      expect(registry.getChild(ChildA)).toBe(childA);
    });

    it('should throw when no child of the given type exists', () => {
      const registry = new RegistryComponent();

      expect(() => registry.getChild(ChildA)).toThrow('No instance of ChildA registered');
    });
  });

  describe('getChildOrNull', () => {
    it('should return null when no child of the given type exists', () => {
      const registry = new RegistryComponent();

      expect(registry.getChildOrNull(ChildA)).toBeNull();
    });

    it('should return the child when exactly one exists', () => {
      const registry = new RegistryComponent();
      const childA = new ChildA();
      registry.addChild(childA);

      expect(registry.getChildOrNull(ChildA)).toBe(childA);
    });

    it('should throw when multiple children of the same type exist', () => {
      const registry = new RegistryComponent();
      registry.addChild(new ChildA());
      registry.addChild(new ChildA());

      expect(() => registry.getChildOrNull(ChildA)).toThrow('Multiple instances of ChildA registered');
    });
  });

  describe('getChildren', () => {
    it('should return empty array when no children of the given type exist', () => {
      const registry = new RegistryComponent();

      expect(registry.getChildren(ChildA)).toEqual([]);
    });

    it('should return all children of the given type', () => {
      const registry = new RegistryComponent();
      const childA1 = new ChildA();
      const childA2 = new ChildA();
      const childB = new ChildB();
      registry.addChild(childA1);
      registry.addChild(childB);
      registry.addChild(childA2);

      const result = registry.getChildren(ChildA);
      expect(result).toEqual([childA1, childA2]);
    });

    it('should not return children of other types', () => {
      const registry = new RegistryComponent();
      registry.addChild(new ChildA());

      expect(registry.getChildren(ChildB)).toEqual([]);
    });
  });
});
