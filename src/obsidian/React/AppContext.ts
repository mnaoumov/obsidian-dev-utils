import { App } from 'obsidian';
import {
  createContext,
  useContext
} from 'react';

export const AppContext = createContext<App | undefined>(undefined);

export const useApp = (): App => {
  const app = useContext(AppContext);
  if (!app) {
    throw new Error('AppContext not found');
  }
  return app;
};
