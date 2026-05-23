/**
 * @file
 *
 * Contains helper function to register async events.
 */

import { Component } from 'obsidian';

import type { AsyncEventRef } from '../../async-events.ts';

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
