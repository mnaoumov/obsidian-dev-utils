/**
 * @file
 *
 * A vitest suite that opens every note of a plugin's in-repo `demo-vault/`, clicks each `code-button`
 * in it against a real Obsidian, and fails on any button that errors or never reports a result.
 *
 * A demo vault's buttons are the one part of it no other gate can check. `lint:md` reads the markdown,
 * the coverage suite ({@link ./demo-vault-coverage.ts | `registerDemoVaultCoverageSuite`}) checks the
 * authoring conventions, and neither executes anything — a button whose `require('/demoSetup.ts')` path
 * is wrong, or that calls an API that has since changed shape, fails at click time and nowhere else.
 *
 * The companion half — seeding the temp vault with the demo-vault tree, its `.obsidian` config, and the
 * CodeScript Toolkit binary that turns ```` ```code-button ```` fences into buttons — is
 * `buildDemoVaultPopulate` in `obsidian-integration-testing`; hand its result to the project's
 * `globalSetup` and name CodeScript Toolkit in `enableCommunityPlugins`.
 */

import {
  readdirSync,
  readFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

import { getRootFolder } from './root.ts';

/**
 * CodeScript Toolkit's manifest id. It is still the plugin's original `fix-require-modules` id, which
 * no longer matches its name — the id is published, so it cannot be changed.
 */
export const CODE_SCRIPT_TOOLKIT_PLUGIN_ID = 'fix-require-modules';

/**
 * The outcome of clicking one button.
 */
export interface DemoVaultButtonResult {
  /**
   * The button's caption, as rendered.
   */
  readonly caption: string;

  /**
   * The result line CodeScript Toolkit printed under the button, truncated.
   */
  readonly output: string;

  /**
   * Whether the button reported success, reported an error, or never reported at all.
   */
  readonly status: 'error' | 'ok' | 'timeout' | 'unknown';
}

/**
 * One demo-vault note and how many buttons its source declares.
 */
export interface DemoVaultNote {
  /**
   * How many `code-button` fences the note's source declares.
   */
  readonly buttonCount: number;

  /**
   * The note's file name, relative to the demo vault root.
   */
  readonly name: string;
}

/**
 * The options for {@link registerDemoVaultButtonSuite}.
 */
export interface RegisterDemoVaultButtonSuiteOptions {
  /**
   * How long, in milliseconds, to wait for a clicked button to report a result.
   *
   * @default `15000`
   */
  readonly buttonResultTimeoutInMilliseconds?: number;

  /**
   * Note file names (relative to the demo vault root) to skip.
   *
   * @default `['README.md']`
   */
  readonly excludedNotes?: readonly string[];

  /**
   * The repository root holding `demo-vault/`.
   *
   * @default the resolved repo root, falling back to `process.cwd()`.
   */
  readonly rootFolder?: string;

  /**
   * How long, in milliseconds, to wait for a note's preview and its buttons to mount.
   *
   * @default `20000`
   */
  readonly settleTimeoutInMilliseconds?: number;
}

/**
 * The waiting budgets a single button click is allowed.
 */
interface ClickButtonTimeouts {
  /**
   * How long to wait for the clicked button to report a result.
   */
  readonly buttonResultTimeoutInMilliseconds: number;

  /**
   * How long to wait for the button itself to mount.
   */
  readonly settleTimeoutInMilliseconds: number;
}

const DEFAULT_BUTTON_RESULT_TIMEOUT_IN_MILLISECONDS = 15_000;
const DEFAULT_SETTLE_TIMEOUT_IN_MILLISECONDS = 20_000;
const POLL_INTERVAL_IN_MILLISECONDS = 100;
const OUTPUT_EXCERPT_LENGTH = 400;

// `README.md` is the repo-facing page GitHub renders, not a walkthrough. `00 Start.md` is deliberately
// NOT excluded: since T478 the landing notes carry buttons of their own.
const DEFAULT_EXCLUDED_NOTES = ['README.md'];

const CODE_BUTTON_FENCE_REG_EXP = /^\s*```code-button/gm;

// The rendered-button selector is `:scope .block-language-code-button button.mod-cta`. It is written
// Out at each use site rather than held in a constant here: every closure below is serialized with
// `toString()` and evaluated inside Obsidian, where nothing from this module's scope exists.

/**
 * Builds the assertion message for a note's failing buttons.
 *
 * The captured output is included because a button's failure is a runtime one — the stack CodeScript
 * Toolkit prints under it is the only diagnosis there is.
 *
 * @param noteName - The note the buttons belong to.
 * @param failures - The failing buttons.
 * @returns The message.
 */
export function formatFailures(noteName: string, failures: readonly DemoVaultButtonResult[]): string {
  if (failures.length === 0) {
    return '';
  }

  const details = failures
    .map((failure) => `  - "${failure.caption}" [${failure.status}]: ${failure.output.replaceAll(/\s+/g, ' ').trim()}`)
    .join('\n');
  return `${String(failures.length)} button(s) in ${noteName} did not run cleanly:\n${details}`;
}

/**
 * Lists the demo vault's top-level notes that declare at least one `code-button`.
 *
 * Only the vault root is walked: `Materials/` holds fixtures the walkthroughs act on, not walkthroughs.
 *
 * @param demoVaultPath - The demo vault root.
 * @param excludedNotes - Note file names to skip.
 * @returns The notes, sorted by name.
 */
export function listNotesWithButtons(demoVaultPath: string, excludedNotes: ReadonlySet<string>): DemoVaultNote[] {
  return readdirSync(demoVaultPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !excludedNotes.has(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      buttonCount: (readFileSync(join(demoVaultPath, name), 'utf-8').match(CODE_BUTTON_FENCE_REG_EXP) ?? []).length,
      name
    }))
    .filter((note) => note.buttonCount > 0);
}

/* v8 ignore start -- Every assertion below runs against a real Obsidian over CDP, driven by closures this process serializes and another executes. The testable parts are listNotesWithButtons and formatFailures, which have their own unit tests. */
/**
 * Registers a vitest suite that clicks every `code-button` in the repo's demo vault.
 *
 * One `it` per note, and one `evalInObsidian` per button: a single closure runs as one CDP
 * `Runtime.evaluate`, which the harness caps at 30 s, so a note with a dozen buttons would otherwise
 * time out as a whole rather than reporting which button failed.
 *
 * @param options - The {@link RegisterDemoVaultButtonSuiteOptions}.
 */
export function registerDemoVaultButtonSuite(options: RegisterDemoVaultButtonSuiteOptions = {}): void {
  const rootFolder = options.rootFolder ?? getRootFolder() ?? process.cwd();
  const demoVaultPath = join(rootFolder, 'demo-vault');
  const excludedNotes = new Set(options.excludedNotes ?? DEFAULT_EXCLUDED_NOTES);
  const settleTimeoutInMilliseconds = options.settleTimeoutInMilliseconds ?? DEFAULT_SETTLE_TIMEOUT_IN_MILLISECONDS;
  const buttonResultTimeoutInMilliseconds = options.buttonResultTimeoutInMilliseconds ?? DEFAULT_BUTTON_RESULT_TIMEOUT_IN_MILLISECONDS;

  const notes = listNotesWithButtons(demoVaultPath, excludedNotes);

  describe('demo-vault buttons', () => {
    beforeAll(async () => {
      const isCodeScriptToolkitLoaded = await checkCodeScriptToolkitLoaded(settleTimeoutInMilliseconds);
      // Without it every `code-button` fence stays a plain code block, so every note below would report
      // Zero buttons and pass vacuously. Fail here instead, once, with the reason.
      expect(isCodeScriptToolkitLoaded, 'CodeScript Toolkit did not load, so no button could render').toBe(true);
    });

    // A vault whose notes declare no buttons is a real failure of G98's interactive half, not a reason
    // To register nothing and report green.
    it('has at least one note with a code button', () => {
      expect(notes.length).toBeGreaterThan(0);
    });

    for (const note of notes) {
      it(`runs every code button in ${note.name}`, async () => {
        const captions = await openNoteAndListButtonCaptions(note, settleTimeoutInMilliseconds);
        // Reading view mounts a note's leading sections more than once while it settles, so the DOM can
        // Hold several elements per fence. The captions are deduplicated, and the assertion is that at
        // Least as many DISTINCT buttons rendered as the source declares — a fence that silently stayed
        // A plain code block is the failure this catches.
        expect(captions.length, `${note.name} declares ${String(note.buttonCount)} button(s) but only ${String(captions.length)} rendered`)
          .toBeGreaterThanOrEqual(note.buttonCount);

        const failures: DemoVaultButtonResult[] = [];
        for (const caption of captions) {
          const result = await clickButton(note.name, caption, {
            buttonResultTimeoutInMilliseconds,
            settleTimeoutInMilliseconds
          });
          if (result.status !== 'ok') {
            failures.push(result);
          }
        }

        expect(failures, formatFailures(note.name, failures)).toEqual([]);
      });
    }
  });
}

/* v8 ignore stop */

/* v8 ignore start -- Drives a real Obsidian over CDP: the closure is serialized here and executed in another process, so it cannot be exercised by a unit test. */
/**
 * Turns restricted mode off and enables CodeScript Toolkit, whose binary the global setup seeded.
 *
 * @param timeoutInMilliseconds - How long to wait for it to load.
 * @returns Whether CodeScript Toolkit is loaded.
 */
async function checkCodeScriptToolkitLoaded(timeoutInMilliseconds: number): Promise<boolean> {
  return evalInObsidian({
    async callback({ app, codeScriptToolkitPluginId, intervalInMilliseconds, lib: { waitUntil }, timeoutInMilliseconds: timeout }): Promise<boolean> {
      if (typeof app.plugins.isEnabled === 'function' && !app.plugins.isEnabled()) {
        await app.plugins.setEnable(true);
      }
      if (!app.plugins.getPlugin(codeScriptToolkitPluginId)) {
        await app.plugins.enablePlugin(codeScriptToolkitPluginId);
      }
      try {
        await waitUntil({
          intervalInMilliseconds,
          message: 'CodeScript Toolkit never loaded',
          predicate: (): boolean => app.plugins.getPlugin(codeScriptToolkitPluginId) !== null,
          timeoutInMilliseconds: timeout
        });
      } catch {
        return false;
      }
      return true;
    },
    input: {
      codeScriptToolkitPluginId: CODE_SCRIPT_TOOLKIT_PLUGIN_ID,
      intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
      timeoutInMilliseconds
    },
    vaultPath: getTemporaryVault().path
  });
}

/* v8 ignore stop */

/* v8 ignore start -- Drives a real Obsidian over CDP: the closure is serialized here and executed in another process, so it cannot be exercised by a unit test. */
/**
 * Clicks one button and reads the result line CodeScript Toolkit writes under it.
 *
 * A button that re-renders its own note (a settings change, a reload) detaches the block it lives in,
 * so the block element is captured BEFORE the click and read afterwards — CodeScript Toolkit writes the
 * result into that same element even once it is detached.
 *
 * @param notePath - The note holding the button.
 * @param buttonCaption - The button's rendered caption, which is how it is addressed.
 * @param timeouts - The render and result budgets.
 * @returns The {@link DemoVaultButtonResult}.
 */
async function clickButton(
  notePath: string,
  buttonCaption: string,
  timeouts: ClickButtonTimeouts
): Promise<DemoVaultButtonResult> {
  return evalInObsidian({
    async callback({
      app,
      buttonResultTimeoutInMilliseconds,
      caption,
      intervalInMilliseconds,
      lib: { waitUntil },
      notePath: notePathToOpen,
      obsidianModule,
      outputExcerptLength,
      settleTimeoutInMilliseconds
    }): Promise<DemoVaultButtonResult> {
      function view(): InstanceType<typeof obsidianModule.MarkdownView> | null {
        return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      }
      function previewEl(): HTMLElement | null {
        return view()?.containerEl.querySelector<HTMLElement>(':scope .markdown-preview-view') ?? null;
      }
      function buttons(): HTMLButtonElement[] {
        return [...view()?.containerEl.querySelectorAll<HTMLButtonElement>(':scope .block-language-code-button button.mod-cta') ?? []];
      }

      function findButton(): HTMLButtonElement | undefined {
        return buttons().find((candidate) => candidate.textContent === caption);
      }

      // Reading view mounts lazily and unmounts sections far off-screen, so NO single scroll position
      // Holds a whole note's buttons. Advance a viewport at a time and wrap back to the top, remounting
      // Every section in turn until the one being looked for appears. Pinning to the BOTTOM instead —
      // What this did until 94.4.1 — only ever mounts the note's tail, so a button anywhere but at the
      // End of its note was reported as never rendered (`status: 'timeout'`, empty output) however
      // Healthy it was.
      const SCROLL_BOTTOM_TOLERANCE_IN_PIXELS = 4;
      const SCROLL_STEP_RATIO = 0.8;
      function advanceScroll(): void {
        const scroller = previewEl();
        if (!scroller) {
          return;
        }
        const isAtBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - SCROLL_BOTTOM_TOLERANCE_IN_PIXELS;
        scroller.scrollTop = isAtBottom ? 0 : scroller.scrollTop + Math.floor(scroller.clientHeight * SCROLL_STEP_RATIO);
      }

      // Re-open the note before every click instead of assuming the previous button left the workspace
      // Where it was found. Every helper above reads the ACTIVE view, and opening a note is one of the
      // Most ordinary things a demo button does — so the first such button would otherwise send each
      // Later button in its note to `status: 'timeout'` with an empty output, which is the shape of a
      // Button that never rendered rather than one that was looked for in the wrong view.
      await app.workspace.openLinkText(notePathToOpen.replace(/\.md$/, ''), '', false);
      await app.workspace.getLeaf(false).setViewState({ state: { file: notePathToOpen, mode: 'preview' }, type: 'markdown' });

      // Held from the predicate rather than re-queried after it: the walk above keeps moving the
      // Viewport, so a button found on one poll can be unmounted again by the next.
      let button: HTMLButtonElement | undefined;
      try {
        await waitUntil({
          intervalInMilliseconds,
          message: `code button "${caption}" never rendered`,
          predicate: (): boolean => {
            advanceScroll();
            button = findButton();
            return button !== undefined;
          },
          timeoutInMilliseconds: settleTimeoutInMilliseconds
        });
      } catch {
        return { caption, output: '', status: 'timeout' };
      }

      if (!button) {
        return { caption, output: '', status: 'timeout' };
      }

      const block = button.closest<HTMLElement>('.block-language-code-button') ?? button.parentElement;
      button.scrollIntoView();
      button.click();

      let status: DemoVaultButtonResult['status'];
      try {
        await waitUntil({
          intervalInMilliseconds,
          message: `button "${caption}" never reported a result`,
          predicate: (): boolean => /Executed (?:successfully|with error)/.test(block?.textContent ?? ''),
          timeoutInMilliseconds: buttonResultTimeoutInMilliseconds
        });
        const text = block?.textContent ?? '';
        if (text.includes('Executed with error')) {
          status = 'error';
        } else if (text.includes('Executed successfully')) {
          status = 'ok';
        } else {
          status = 'unknown';
        }
      } catch {
        status = 'timeout';
      }

      return { caption, output: (block?.textContent ?? '').slice(0, outputExcerptLength), status };
    },
    input: {
      buttonResultTimeoutInMilliseconds: timeouts.buttonResultTimeoutInMilliseconds,
      caption: buttonCaption,
      intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
      notePath,
      outputExcerptLength: OUTPUT_EXCERPT_LENGTH,
      settleTimeoutInMilliseconds: timeouts.settleTimeoutInMilliseconds
    },
    vaultPath: getTemporaryVault().path
  });
}

/**
 * Opens a note in reading view and lists the captions of the buttons that mounted, deduplicated and in
 * document order.
 *
 * Two quirks of reading view shape this. It renders lazily and unmounts sections far off-screen, so no
 * single scroll position holds a whole note's buttons — the preview is walked top to bottom and back
 * while waiting, and the captions seen along the way are ACCUMULATED rather than read once at the end.
 * And while it settles it can hold SEVERAL elements per fence — the same button was observed rendered
 * twice — so the captions are deduplicated; clicking by caption then addresses each button once however
 * many copies of it the DOM is holding.
 *
 * @param note - The note to open.
 * @param settleTimeoutInMilliseconds - How long to wait for the buttons to mount.
 * @returns The distinct button captions.
 */
async function openNoteAndListButtonCaptions(note: DemoVaultNote, settleTimeoutInMilliseconds: number): Promise<string[]> {
  return evalInObsidian({
    async callback({ app, expectedButtonCount, intervalInMilliseconds, lib: { waitUntil }, notePath, obsidianModule, timeoutInMilliseconds }): Promise<string[]> {
      function view(): InstanceType<typeof obsidianModule.MarkdownView> | null {
        return app.workspace.getActiveViewOfType(obsidianModule.MarkdownView);
      }
      function previewEl(): HTMLElement | null {
        return view()?.containerEl.querySelector<HTMLElement>(':scope .markdown-preview-view') ?? null;
      }
      // Accumulated across the walk below, never read from one snapshot: with the viewport moving, any
      // Single reading holds only the sections currently mounted.
      const seenCaptions = new Set<string>();
      function captions(): string[] {
        for (const button of view()?.containerEl.querySelectorAll<HTMLButtonElement>(':scope .block-language-code-button button.mod-cta') ?? []) {
          if (button.textContent !== '') {
            seenCaptions.add(button.textContent);
          }
        }
        return [...seenCaptions];
      }

      // Same walk as `clickButton`, and for the same reason: a note whose buttons are in the MIDDLE
      // Never mounts them if the preview is pinned to the bottom.
      const SCROLL_BOTTOM_TOLERANCE_IN_PIXELS = 4;
      const SCROLL_STEP_RATIO = 0.8;
      function advanceScroll(): void {
        const scroller = previewEl();
        if (!scroller) {
          return;
        }
        const isAtBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - SCROLL_BOTTOM_TOLERANCE_IN_PIXELS;
        scroller.scrollTop = isAtBottom ? 0 : scroller.scrollTop + Math.floor(scroller.clientHeight * SCROLL_STEP_RATIO);
      }

      await app.workspace.openLinkText(notePath.replace(/\.md$/, ''), '', false);
      await app.workspace.getLeaf(false).setViewState({ state: { file: notePath, mode: 'preview' }, type: 'markdown' });

      try {
        await waitUntil({
          intervalInMilliseconds,
          message: `"${notePath}" never mounted all ${String(expectedButtonCount)} of its buttons`,
          predicate: (): boolean => {
            advanceScroll();
            return captions().length >= expectedButtonCount;
          },
          timeoutInMilliseconds
        });
      } catch {
        // The captions are returned either way; the caller asserts on them and reports the shortfall.
      }

      return captions();
    },
    input: {
      expectedButtonCount: note.buttonCount,
      intervalInMilliseconds: POLL_INTERVAL_IN_MILLISECONDS,
      notePath: note.name,
      timeoutInMilliseconds: settleTimeoutInMilliseconds
    },
    vaultPath: getTemporaryVault().path
  });
}

/* v8 ignore stop */
