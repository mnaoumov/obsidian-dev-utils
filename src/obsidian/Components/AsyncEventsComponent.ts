/**
 * @packageDocumentation
 *
 * Contains a component and a helper function to register async events.
 */

import { Component } from 'obsidian';

import type { AsyncEventRef } from '../../AsyncEvents.ts';

/**
 * A component that can register async events.
 */
export class AsyncEventsComponent extends Component {
  /**
   * Registers an async event.
   *
   * @param eventRef - The event reference.
   */
  public registerAsyncEvent(eventRef: AsyncEventRef): void {
    registerAsyncEvent(this, eventRef);
  }
}

/**
 * Registers an async event.
 *
 * @param component - The component.
 * @param eventRef - The event reference.
 */
export function registerAsyncEvent(component: Component, eventRef: AsyncEventRef): void {
  component.register(() => {
    eventRef.asyncEvents.offref(eventRef);
  });
}
