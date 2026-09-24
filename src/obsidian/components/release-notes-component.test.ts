// @vitest-environment jsdom

/**
 * @file
 *
 * Tests for {@link ReleaseNotesComponent}.
 */

import type { App as AppOriginal } from 'obsidian';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AlertParams } from '../modals/alert.ts';
import type { PluginSettingsComponentBase } from './plugin-settings-component.ts';
import type { ReleaseNotes } from './release-notes-component.ts';

import {
  noop,
  noopAsync
} from '../../function.ts';
import { strictProxy } from '../../strict-proxy.ts';
import { ReleaseNotesComponent } from './release-notes-component.ts';

interface ComponentContext {
  readonly component: ReleaseNotesComponent;
  /**
   * Completes the host's pending settings load, optionally with the shown versions the file turned out to
   * hold. Only meaningful when the component was created with `isSettingsLoadPending`.
   */
  finishSettingsLoad: (shownVersions?: readonly string[]) => void;
  readonly getShownVersions: () => readonly string[];
  readonly setShownReleaseNoteVersions: ReturnType<typeof vi.fn>;
  triggerLayoutReady: () => void;
}

interface CreateComponentOptions {
  readonly isSettingsLoadPending?: boolean;
  readonly releaseNotes?: ReleaseNotes;
  readonly shouldShowReleaseNotes?: () => boolean;
  readonly shownVersions?: readonly string[];
}

const PLUGIN_NAME = 'Sample Plugin';

const { mockAlert } = vi.hoisted(() => ({
  mockAlert: vi.fn()
}));

vi.mock('../modals/alert.ts', () => ({
  alert: mockAlert
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAlert.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function createComponent(options: CreateComponentOptions = {}): ComponentContext {
  let layoutReadyCallback: (() => void) | undefined;

  const app = strictProxy<AppOriginal>({
    workspace: {
      onLayoutReady: vi.fn((callback: () => void) => {
        layoutReadyCallback = callback;
      })
    }
  });

  let shownVersions = options.shownVersions ?? [];
  const setShownReleaseNoteVersions = vi.fn((versions: readonly string[]) => {
    shownVersions = versions;
  });

  let resolveSettingsLoad = noop;
  const settingsLoadPromise = options.isSettingsLoadPending
    ? new Promise<void>((resolve) => {
      resolveSettingsLoad = resolve;
    })
    : noopAsync();

  const component = new ReleaseNotesComponent({
    app,
    getShownReleaseNoteVersions: (): readonly string[] => shownVersions,
    pluginName: PLUGIN_NAME,
    pluginSettingsComponent: strictProxy<PluginSettingsComponentBase<object>>({
      whenLoadedFromFile: (): Promise<void> => settingsLoadPromise
    }),
    releaseNotesProvider: (): ReleaseNotes => options.releaseNotes ?? createReleaseNotes('1.0.0', '2.0.0'),
    setShownReleaseNoteVersions,
    ...(options.shouldShowReleaseNotes && { shouldShowReleaseNotes: options.shouldShowReleaseNotes })
  });

  return {
    component,
    finishSettingsLoad: (shownVersionsFromFile?: readonly string[]): void => {
      if (shownVersionsFromFile) {
        shownVersions = shownVersionsFromFile;
      }
      resolveSettingsLoad();
    },
    getShownVersions: (): readonly string[] => shownVersions,
    setShownReleaseNoteVersions,
    triggerLayoutReady: (): void => {
      layoutReadyCallback?.();
    }
  };
}

function createReleaseNotes(...versions: string[]): ReleaseNotes {
  return Object.fromEntries(versions.map((version) => [
    version,
    createFragment((f) => {
      f.appendText(`Note ${version}`);
    })
  ]));
}

function getAlertParams(): AlertParams {
  const params = mockAlert.mock.calls[0]?.[0] as AlertParams | undefined;
  if (!params) {
    throw new Error('alert was not called.');
  }
  return params;
}

function getHeadings(params: AlertParams): string[] {
  const container = createDiv();
  container.append(params.message);
  return Array.from(container.querySelectorAll('h3'), (el) => el.textContent);
}

async function loadAndReachLayoutReady(context: ComponentContext): Promise<void> {
  context.component.load();
  context.triggerLayoutReady();
  await vi.runAllTimersAsync();
}

describe('ReleaseNotesComponent', () => {
  it('should show every unseen note under a title naming the plugin', async () => {
    const context = createComponent();
    await loadAndReachLayoutReady(context);

    expect(mockAlert).toHaveBeenCalledOnce();
    const params = getAlertParams();
    expect(params.title).toBe(`${PLUGIN_NAME} release notes`);
    expect(getHeadings(params)).toEqual(['1.0.0', '2.0.0']);
    expect(context.getShownVersions()).toEqual(['1.0.0', '2.0.0']);
  });

  it('should skip the notes already shown and keep the stored ones', async () => {
    const context = createComponent({ shownVersions: ['1.0.0'] });
    await loadAndReachLayoutReady(context);

    expect(getHeadings(getAlertParams())).toEqual(['2.0.0']);
    expect(context.setShownReleaseNoteVersions).toHaveBeenCalledWith(['1.0.0', '2.0.0']);
  });

  it('should order the notes by version, not by how the keys were written', async () => {
    const context = createComponent({ releaseNotes: createReleaseNotes('10.0.0', '2.0.0', '9.1.0') });
    await loadAndReachLayoutReady(context);

    expect(getHeadings(getAlertParams())).toEqual(['2.0.0', '9.1.0', '10.0.0']);
  });

  it('should show nothing when every note has been shown', async () => {
    const context = createComponent({ shownVersions: ['1.0.0', '2.0.0'] });
    await loadAndReachLayoutReady(context);

    expect(mockAlert).not.toHaveBeenCalled();
    expect(context.setShownReleaseNoteVersions).not.toHaveBeenCalled();
  });

  it('should neither show nor record anything while the gate declines', async () => {
    const context = createComponent({ shouldShowReleaseNotes: () => false });
    await loadAndReachLayoutReady(context);

    expect(mockAlert).not.toHaveBeenCalled();
    expect(context.setShownReleaseNoteVersions).not.toHaveBeenCalled();
  });

  it('should wait for the host settings before reading the shown versions', async () => {
    // The regression this component was built to fail: when the plugin is enabled after the layout is ready,
    // the layout-ready callback fires while the host's settings are still being read, so reading right then
    // sees the default empty list and shows every note again on every start.
    const context = createComponent({ isSettingsLoadPending: true });
    await loadAndReachLayoutReady(context);

    expect(mockAlert).not.toHaveBeenCalled();

    context.finishSettingsLoad(['1.0.0', '2.0.0']);
    await vi.runAllTimersAsync();

    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('should show nothing when unloaded while the host settings were loading', async () => {
    const context = createComponent({ isSettingsLoadPending: true });
    await loadAndReachLayoutReady(context);

    context.component.unload();
    context.finishSettingsLoad();
    await vi.runAllTimersAsync();

    expect(mockAlert).not.toHaveBeenCalled();
  });
});
