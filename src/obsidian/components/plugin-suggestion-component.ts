/**
 * @file
 *
 * Component that suggests installing another community plugin the host plugin needs in order to offer
 * some of its behavior.
 *
 * A suggestion is not a dependency. Obsidian has no mechanism for one community plugin to require
 * another, and inventing one by refusing to load would punish the user for something they never agreed
 * to. So the host plugin keeps working without the suggested plugin — it simply cannot offer whatever
 * that plugin owns — and this component asks, once, whether the user would like it installed.
 *
 * The ask is surfaced twice, deliberately, because the two placements answer different questions:
 * a notice on load ("you are missing something you probably want") and a settings-tab banner ("the
 * settings you came looking for live in another plugin"). Declining silences only the notice — a user
 * who opens the settings tab is asking about the feature right then, so the banner stays.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import { ButtonComponent } from 'obsidian';

import type { PluginNoticeComponent } from './plugin-notice-component.ts';

import { convertAsyncToSync } from '../../async.ts';
import {
  enableCommunityPlugin,
  installConfigureEnableCommunityPlugin
} from '../community-plugins.ts';
import { CssClass } from '../css-class.ts';
import { t } from '../i18n/i18n.ts';
import { ComponentEx } from './component-ex.ts';
import { CallbackLayoutReadyComponent } from './layout-ready-component.ts';

/**
 * How the suggested plugin is currently present in the vault.
 */
export enum SuggestedPluginState {
  /**
   * Installed and enabled — there is nothing to suggest.
   */
  Enabled = 'enabled',

  /**
   * Installed but disabled. Only an enable is needed, so no download happens.
   */
  InstalledButDisabled = 'installedButDisabled',

  /**
   * Not installed at all.
   */
  NotInstalled = 'notInstalled'
}

/**
 * Parameters for the {@link PluginSuggestionComponent} constructor.
 */
export interface PluginSuggestionComponentConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * Whether the user has already declined this suggestion.
   *
   * Storage belongs to the host plugin (typically one of its settings), because this component has no
   * `data.json` of its own and a decline has to outlive a reload.
   *
   * @returns `true` when the suggestion has been declined.
   */
  isSuggestionDeclined(this: void): boolean;

  /**
   * The notice component of the plugin making the suggestion, used to show the suggestion and its
   * outcome.
   */
  readonly pluginNoticeComponent: PluginNoticeComponent;

  /**
   * The localized sentence explaining what the host plugin cannot do without the suggested plugin. The
   * host plugin owns this string: only it knows which of its features are affected.
   */
  readonly reason: string;

  /**
   * Records the user's answer to the suggestion.
   *
   * @param isDeclined - `true` when the user declined.
   * @returns A {@link Promise} that resolves once the answer is persisted.
   */
  setSuggestionDeclined(this: void, isDeclined: boolean): Promisable<void>;

  /**
   * The id of the suggested plugin, as listed in Obsidian's community plugin registry.
   */
  readonly suggestedPluginId: string;

  /**
   * The display name of the suggested plugin, shown to the user.
   */
  readonly suggestedPluginName: string;
}

/**
 * Suggests installing another community plugin, via a load-time notice and a settings-tab banner.
 */
export class PluginSuggestionComponent extends ComponentEx {
  private readonly app: App;
  private readonly isSuggestionDeclined: () => boolean;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly reason: string;
  private readonly setSuggestionDeclined: (isDeclined: boolean) => Promisable<void>;
  private readonly suggestedPluginId: string;
  private readonly suggestedPluginName: string;

  /**
   * Creates an instance of {@link PluginSuggestionComponent}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: PluginSuggestionComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.reason = params.reason;
    this.suggestedPluginId = params.suggestedPluginId;
    this.suggestedPluginName = params.suggestedPluginName;
    this.isSuggestionDeclined = params.isSuggestionDeclined;
    this.setSuggestionDeclined = params.setSuggestionDeclined;
  }

  /**
   * Resolves how the suggested plugin is currently present in the vault.
   *
   * @returns The {@link SuggestedPluginState}.
   */
  public getSuggestedPluginState(): SuggestedPluginState {
    if (this.app.plugins.enabledPlugins.has(this.suggestedPluginId)) {
      return SuggestedPluginState.Enabled;
    }

    return Object.hasOwn(this.app.plugins.manifests, this.suggestedPluginId)
      ? SuggestedPluginState.InstalledButDisabled
      : SuggestedPluginState.NotInstalled;
  }

  /**
   * Installs (when needed) and enables the suggested plugin, reporting the outcome as a notice.
   *
   * @returns A {@link Promise} that resolves once the plugin is enabled, or once the failure has been
   * reported.
   */
  public async installAndEnableSuggestedPlugin(): Promise<void> {
    const state = this.getSuggestedPluginState();
    if (state === SuggestedPluginState.Enabled) {
      return;
    }

    try {
      if (state === SuggestedPluginState.InstalledButDisabled) {
        await enableCommunityPlugin({
          app: this.app,
          pluginId: this.suggestedPluginId
        });
      } else {
        await installConfigureEnableCommunityPlugin({
          app: this.app,
          pluginId: this.suggestedPluginId
        });
      }
    } catch (error) {
      this.pluginNoticeComponent.showNotice(t(($) => $.obsidianDevUtils.pluginSuggestion.installFailed, {
        pluginName: this.suggestedPluginName
      }));
      throw error;
    }

    await this.setSuggestionDeclined(false);
    this.pluginNoticeComponent.showNotice(t(($) => $.obsidianDevUtils.pluginSuggestion.installed, {
      pluginName: this.suggestedPluginName
    }));
  }

  /**
   * Loads the component, showing the suggestion notice once the layout is ready.
   *
   * The wait matters: plugins load in an unspecified order, so the suggested plugin may well be enabled
   * a moment after this one. Checking before the layout is ready would suggest installing something the
   * user already has.
   */
  public override onload(): void {
    this.addChild(
      new CallbackLayoutReadyComponent(this.app, () => {
        this.showSuggestionNotice();
      })
    );
  }

  /**
   * Renders the suggestion banner into a settings-tab container, with a button that installs and enables
   * the suggested plugin.
   *
   * Renders nothing when the suggested plugin is already enabled. Unlike the notice, the banner ignores a
   * previous decline — the user is looking at these settings right now, which is a fresher signal than an
   * answer they gave earlier.
   *
   * @param containerEl - The element to render the banner into.
   */
  public renderBanner(containerEl: HTMLElement): void {
    const state = this.getSuggestedPluginState();
    if (state === SuggestedPluginState.Enabled) {
      return;
    }

    const bannerEl = containerEl.createDiv({
      cls: [CssClass.LibraryName, CssClass.PluginSuggestionBanner]
    });
    bannerEl.createDiv({ text: this.reason });

    new ButtonComponent(bannerEl)
      .setButtonText(this.getActionButtonText(state))
      .setCta()
      .onClick(convertAsyncToSync(async () => {
        await this.installAndEnableSuggestedPlugin();
      }));
  }

  private getActionButtonText(state: SuggestedPluginState): string {
    return t(($) =>
      state === SuggestedPluginState.InstalledButDisabled
        ? $.obsidianDevUtils.pluginSuggestion.enable
        : $.obsidianDevUtils.pluginSuggestion.install
    );
  }

  private showSuggestionNotice(): void {
    const state = this.getSuggestedPluginState();
    if (state === SuggestedPluginState.Enabled || this.isSuggestionDeclined()) {
      return;
    }

    const fragment = createFragment((fragmentEl) => {
      fragmentEl.createDiv({ text: this.reason });
      const buttonsEl = fragmentEl.createDiv();

      new ButtonComponent(buttonsEl)
        .setButtonText(this.getActionButtonText(state))
        .setCta()
        .onClick(convertAsyncToSync(async () => {
          await this.installAndEnableSuggestedPlugin();
        }));

      new ButtonComponent(buttonsEl)
        .setButtonText(t(($) => $.obsidianDevUtils.pluginSuggestion.notNow))
        .onClick(convertAsyncToSync(async () => {
          await this.setSuggestionDeclined(true);
        }));
    });

    this.pluginNoticeComponent.showNotice(fragment, { shouldHideOnClick: false });
  }
}
