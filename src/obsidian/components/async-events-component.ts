/**
 * @file
 *
 * Contains helper function to register async events.
 */

import { Component } from 'obsidian';

import type { AsyncEventRef as AsyncEventReference } from '../../async-events.ts';

/**
 * Registers an async event.
 *
 * @param component - The component.
 * @param eventReference - The event reference.
 */
export function registerAsyncEvent(component: Component, eventReference: AsyncEventReference): void {
  component.register(() => {
    eventReference.asyncEventSource.offref(eventReference);
  });
}
