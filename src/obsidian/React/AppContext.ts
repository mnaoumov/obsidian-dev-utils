import { App } from 'obsidian';
import {
  createContext,
  useContext
} from 'react';

/**
 * The context for the app.
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
 * The hook to use the app context.
 */
export const useApp = (): App => {
  const app = useContext(AppContext);
  if (!app) {
    throw new Error('AppContext not found');
  }
  return app;
};
