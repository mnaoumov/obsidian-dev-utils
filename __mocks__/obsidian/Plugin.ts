import type { App } from './App.ts';

export class Plugin {
  app: App = null as unknown as App;
  manifest = { id: '', name: '', version: '' };
  addCommand(_cmd: unknown): unknown {
    return {};
  }

  loadData(): Promise<unknown> {
    return Promise.resolve({});
  }

  register(_cb: () => void): void {}
  registerEvent(_ref: unknown): void {}
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
}
