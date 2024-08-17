import {
  Notice,
  Plugin,
  PluginSettingTab
} from "obsidian";
import { registerAsyncErrorEventHandler } from "../../Error.ts";
import { PluginSettingsBase } from "./PluginSettingsBase.ts";
import { type Constructor } from "../../Type.ts";

export abstract class PluginBase<PluginSettings extends PluginSettingsBase> extends Plugin {
  private _settings!: PluginSettings;
  private notice?: Notice;
  private _abortSignal!: AbortSignal;

  protected get abortSignal(): AbortSignal {
    return this._abortSignal;
  }

  public get settings(): PluginSettings {
    return PluginSettingsBase.clone(this._settings);
  }

  protected abstract get PluginSettingsConstructor(): Constructor<PluginSettings>;
  protected abstract createPluginSettingsTab(): PluginSettingTab | null;

  public override async onload(): Promise<void> {
    await this.loadSettings();
    const pluginSettingsTab = this.createPluginSettingsTab();
    if (pluginSettingsTab) {
      this.addSettingTab(pluginSettingsTab);
    }
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

  protected onLayoutReady(): void { }

  private async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this._settings = await this.parseSettings(data);
  }

  protected async parseSettings(data: unknown): Promise<PluginSettings> {
    return PluginSettingsBase.load(this.PluginSettingsConstructor, data);
  }

  public async saveSettings(newSettings: PluginSettings): Promise<void> {
    this._settings = PluginSettingsBase.clone(newSettings);
    await this.saveData(this._settings);
  }

  protected showNotice(message: string): void {
    if (this.notice) {
      this.notice.hide();
    }

    this.notice = new Notice(`${this.manifest.name}\n${message}`);
  }
}
