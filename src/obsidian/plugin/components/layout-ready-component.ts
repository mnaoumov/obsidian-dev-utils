/**
 * @file
 *
 * Interface for components that need to perform work when the workspace layout is ready.
 */

import type { Promisable } from 'type-fest';

/**
 * Components implementing this interface will have {@link onLayoutReady} called
 * by PluginBase after the workspace layout is ready, with error isolation.
 */
export interface LayoutReadyComponent {
  /**
   * Called when the workspace layout is ready.
   *
   * @returns A {@link Promise} that resolves when layout-ready work is complete.
   */
  onLayoutReady(): Promisable<void>;
}
