/**
 * @file
 *
 * Component that shows a plugin's release notes once, when the workspace layout is ready.
 *
 * Several plugins hand-rolled this popup, and every copy had the same defect: it was titled only
 * `Release notes`, over headings that are bare version numbers, so nothing in it named the plugin. A user
 * with dozens of plugins installed could not tell whose popup it was. This component always names the
 * plugin in the title.
 *
 * It also owns the wait every copy needed. The notes already shown are stored in the host's settings, and
 * the host's settings component is a SIBLING whose own async load is still in flight when the plugin is
 * enabled after the layout is ready. Reading the list then sees the default empty one and shows every note
 * again, on every start. See {@link PluginSettingsComponentBase.whenLoadedFromFile}.
 */

import type { App } from 'obsidian';
import type { Promisable } from 'type-fest';

import { compareVersions } from 'compare-versions';

import type { PluginSettingsComponentBase } from './plugin-settings-component.ts';

import { t } from '../i18n/i18n.ts';
import { alert } from '../modals/alert.ts';
import { ComponentEx } from './component-ex.ts';
import { CallbackLayoutReadyComponent } from './layout-ready-component.ts';

/**
 * Release notes, keyed by the semantic version that introduced each one.
 */
export type ReleaseNotes = Readonly<Record<string, DocumentFragment>>;

/**
 * Parameters for the {@link ReleaseNotesComponent} constructor.
 */
export interface ReleaseNotesComponentConstructorParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * Returns the versions whose notes the user has already seen.
   *
   * Storage belongs to the host plugin, typically as one of its settings, because this component has no
   * `data.json` of its own and the list has to outlive a reload.
   *
   * Only ever called once {@link pluginSettingsComponent} reports its settings loaded, so an implementation
   * that reads a setting reads the stored value rather than its default.
   *
   * @returns The versions already shown.
   */
  readonly getShownReleaseNoteVersions: () => readonly string[];

  /**
   * The display name of the plugin, shown in the popup title.
   */
  readonly pluginName: string;

  /**
   * The settings component holding whatever {@link getShownReleaseNoteVersions} reads.
   *
   * Taken as a whole component rather than as a bare "ready" flag, so the host cannot forget to wire the
   * wait.
   */
  readonly pluginSettingsComponent: PluginSettingsComponentBase<object>;

  /**
   * Builds the release notes.
   *
   * Called at layout ready rather than at construction, so the fragments are built only when they may be
   * shown, and a localized string is read after the host's translations are set up.
   *
   * Every key must be a valid semantic version. The notes are shown in ascending version order, whatever
   * order the keys were written in.
   *
   * @returns The release notes.
   */
  readonly releaseNotesProvider: () => ReleaseNotes;

  /**
   * Records the versions whose notes the user has now seen.
   *
   * Called before the popup is shown, with the full list: the versions already shown followed by the ones
   * about to be.
   *
   * @param versions - The versions shown.
   * @returns A {@link Promise} that resolves once the list is persisted.
   */
  readonly setShownReleaseNoteVersions: (versions: readonly string[]) => Promisable<void>;

  /**
   * Decides whether the release notes may be shown now.
   *
   * When it returns `false`, nothing is shown and nothing is recorded, so the notes are shown at a later
   * start once it returns `true`. Use it when the notes only make sense while some feature is on.
   *
   * @returns `true` when the notes may be shown.
   * @default Always `true`.
   */
  readonly shouldShowReleaseNotes?: () => Promisable<boolean>;
}

/**
 * Shows a plugin's release notes that the user has not seen yet, once the workspace layout is ready.
 */
export class ReleaseNotesComponent extends ComponentEx {
  /**
   * The Obsidian app instance.
   */
  protected readonly app: App;

  /**
   * The display name of the plugin, shown in the popup title.
   */
  protected readonly pluginName: string;

  /**
   * The settings component whose load is awaited before the shown versions are read.
   */
  protected readonly pluginSettingsComponent: PluginSettingsComponentBase<object>;

  private readonly getShownReleaseNoteVersions: () => readonly string[];
  private readonly releaseNotesProvider: () => ReleaseNotes;
  private readonly setShownReleaseNoteVersions: (versions: readonly string[]) => Promisable<void>;
  private readonly shouldShowReleaseNotes: () => Promisable<boolean>;

  /**
   * Creates an instance of {@link ReleaseNotesComponent}.
   *
   * @param params - The constructor parameters.
   */
  public constructor(params: ReleaseNotesComponentConstructorParams) {
    super();
    this.app = params.app;
    this.getShownReleaseNoteVersions = params.getShownReleaseNoteVersions;
    this.pluginName = params.pluginName;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.releaseNotesProvider = params.releaseNotesProvider;
    this.setShownReleaseNoteVersions = params.setShownReleaseNoteVersions;
    this.shouldShowReleaseNotes = params.shouldShowReleaseNotes ?? ((): boolean => true);
  }

  /**
   * Loads the component, showing the unseen release notes once the layout is ready AND the host's settings
   * have been read from disk.
   */
  public override onload(): void {
    this.addChild(
      new CallbackLayoutReadyComponent(this.app, async () => {
        await this.pluginSettingsComponent.whenLoadedFromFile();
        if (this.isUnloaded()) {
          return;
        }

        await this.showUnseenReleaseNotes();
      })
    );
  }

  /**
   * Shows the release notes the user has not seen yet, and records them as seen.
   *
   * Does nothing when {@link ReleaseNotesComponentConstructorParams.shouldShowReleaseNotes} declines, or when
   * every note has been shown already.
   *
   * @returns A {@link Promise} that resolves once the popup is closed, or at once when nothing is shown.
   */
  protected async showUnseenReleaseNotes(): Promise<void> {
    if (!await this.shouldShowReleaseNotes()) {
      return;
    }

    const shownVersions = this.getShownReleaseNoteVersions();
    const shownVersionSet = new Set(shownVersions);
    const unseenReleaseNotes = Object.entries(this.releaseNotesProvider())
      .filter(([version]) => !shownVersionSet.has(version))
      .sort(([version1], [version2]) => compareVersions(version1, version2));

    if (unseenReleaseNotes.length === 0) {
      return;
    }

    const message = createFragment();
    for (const [version, releaseNote] of unseenReleaseNotes) {
      message.createEl('h3', { text: version });
      message.append(releaseNote);
    }

    // Recorded before the popup is shown, so a user who reloads without closing it is not shown it again.
    await this.setShownReleaseNoteVersions([...shownVersions, ...unseenReleaseNotes.map(([version]) => version)]);

    await alert({
      app: this.app,
      message,
      title: t(($) => $.obsidianDevUtils.releaseNotes.title, { pluginName: this.pluginName })
    });
  }
}
