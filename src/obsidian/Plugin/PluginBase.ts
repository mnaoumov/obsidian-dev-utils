import {
  Notice,
  Plugin
} from "obsidian";
import { registerAsyncErrorEventHandler } from "../../Error.ts";

export abstract class PluginBase extends Plugin {
  private notice?: Notice;

  public override onload(): void {
    this.register(registerAsyncErrorEventHandler(() => {
      this.showNotice("An unhandled error occurred. Please check the console for more information.");
    }));
  }

  protected showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.manifest.name}\n${message}`);
  }
}
