/**
 * @file
 *
 * Bridges internal Obsidian Component properties (`_loaded`, `_children`)
 * onto the mock Component via internal `loaded__` and `children__` fields.
 */

import { Component } from 'obsidian-test-mocks/obsidian';

import { defineMissingProperty } from './define-missing-property.ts';

/**
 * Patches Component prototype to expose `_loaded` and `_children`
 * from the Obsidian API.
 */
export function mockComponent(): void {
  defineMissingProperty(Component.prototype, '_loaded', {
    get(this: Component): boolean {
      return this.loaded__;
    },
    set(this: Component, value: boolean): void {
      this.loaded__ = value;
    }
  });

  defineMissingProperty(Component.prototype, '_children', {
    get(this: Component): Component[] {
      return this.children__;
    },
    set(this: Component, value: Component[]): void {
      this.children__ = value;
    }
  });
}
