/**
 * @file
 *
 * Contains helper function to register async events.
 */

import type { AsyncEventRef } from '@mnaoumov/typescript-lib/async-events';

import { Component } from 'obsidian';

/**
 * Registers an async event.
 *
 * @param component - The component.
 * @param eventRef - The event reference.
 */
export function registerAsyncEvent(component: Component, eventRef: AsyncEventRef): void {
  component.register(() => {
    eventRef.asyncEventSource.offref(eventRef);
  });
}
