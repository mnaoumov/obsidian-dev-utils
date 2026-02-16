/**
 * @packageDocumentation
 *
 * Passes obsidian {@link App} instance to React components.
 */

import { App } from 'obsidian';
import {
  createContext,
  useContext
} from 'react';

import { ensureNonNullable } from '../../ObjectUtils.ts';

/**
 * A context for the app.
 *
 * Usage:
 * ```tsx
 * <AppContext.Provider value={app}>
 *   <YourComponent />
 * </AppContext.Provider>
 * ```
 */
export const AppContext = createContext<App | undefined>(undefined);

/**
 * A hook to use the app context.
 *
 * @returns The app instance.
 */
export function useApp(): App {
  return ensureNonNullable(useContext(AppContext), () => 'AppContext not found');
}
