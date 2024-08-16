import {
  Notice,
  Plugin
} from "obsidian";
import { registerAsyncErrorEventHandler } from "../../Error.ts";

export abstract class PluginBase extends Plugin {
  private notice?: Notice;
  private _abortSignal!: AbortSignal;

  protected get abortSignal(): AbortSignal {
    return this._abortSignal;
  }

  public override async onload(): Promise<void> {
    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice("An unhandled error occurred. Please check the console for more information.");
    }));

    const abortController = new AbortController();
    this._abortSignal = abortController.signal;
    this.register(() => abortController.abort());
    await this.onloadComplete();
    this.app.workspace.onLayoutReady(() => this.onLayoutReady());
  }

  protected abstract onloadComplete(): Promise<void>;

  protected onLayoutReady(): void {
  }

  protected showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.manifest.name}\n${message}`);
  }
}
