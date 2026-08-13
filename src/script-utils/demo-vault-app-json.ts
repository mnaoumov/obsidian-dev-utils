/**
 * @file
 *
 * The `.obsidian/app.json` settings `obsidian-dev-utils` owns in every demo vault.
 *
 * A demo vault is documentation first and an editing surface second, so four Obsidian settings have to be
 * the same in every one of them. They are **not** committed: a vault that wrote them itself would drift
 * (measured 2026-08-13, only 3 of 23 vaults had the first pair and 1 of 23 the second), so this package
 * owns them instead — {@link archivePluginDemoVault} merges them into the `app.json` of the archived copy
 * at release time, and the demo-vault coverage suite fails a vault that commits any of them.
 *
 * - `defaultViewMode: 'preview'` + `livePreview: false` — a note opens as a reader sees it rather than as
 *   raw markup. Obsidian-only: GitHub never reads `app.json` and renders every note as HTML regardless.
 * - `useMarkdownLinks: true` + `newLinkFormat: 'relative'` — what Obsidian writes when a link is created
 *   inside the vault. Left at Obsidian's defaults (`false` / `'shortest'`) every new link comes out as a
 *   shortest-path `[[wikilink]]`, the form the coverage suite rejects and GitHub renders as literal
 *   brackets. `relative` rather than `absolute` so notes keep resolving once the vault is extracted to an
 *   arbitrary folder.
 *
 * All four are written explicitly, never left to an Obsidian default: a vault leaning on a default changes
 * behavior when that default does.
 *
 * Kept free of both `vitest` and `adm-zip` on purpose — the coverage suite pulls in the former and the
 * archiver the latter, and neither may reach the other's environment.
 */

import { toJson } from '../object-utils.ts';

/**
 * Parameters for {@link buildArchivedDemoVaultAppJsonContent}.
 */
export interface BuildArchivedDemoVaultAppJsonContentParams {
  /**
   * The demo vault's committed `app.json`, parsed by {@link parseDemoVaultAppJson}.
   */
  readonly appJson: DemoVaultAppJson;
}

/**
 * A parsed `.obsidian/app.json`. Only the settings in {@link DEMO_VAULT_APP_JSON_SETTINGS} are interpreted;
 * every other setting is carried through untouched.
 */
export type DemoVaultAppJson = Record<string, unknown>;

/**
 * Parameters for {@link findOwnedDemoVaultAppJsonSettings}.
 */
export interface FindOwnedDemoVaultAppJsonSettingsParams {
  /**
   * The demo vault's committed `app.json`, parsed by {@link parseDemoVaultAppJson}.
   */
  readonly appJson: DemoVaultAppJson;
}

/**
 * Parameters for {@link parseDemoVaultAppJson}.
 */
export interface ParseDemoVaultAppJsonParams {
  /**
   * The raw file content, or `null` when the vault commits no `app.json` at all — which is the expected
   * state for a vault that has nothing else to configure.
   */
  readonly content: null | string;

  /**
   * The path the content was read from, named in the error when it does not parse.
   */
  readonly path: string;
}

/**
 * The `.obsidian/app.json` settings this package writes into every archived demo vault, and that a demo
 * vault must therefore never commit. See the file overview for what each one buys.
 */
export const DEMO_VAULT_APP_JSON_SETTINGS: DemoVaultAppJson = {
  defaultViewMode: 'preview',
  livePreview: false,
  newLinkFormat: 'relative',
  useMarkdownLinks: true
};

/**
 * Builds the `app.json` content for the archived copy of a demo vault: the committed settings with the
 * owned ones merged over them.
 *
 * @param params - The parameters for the build.
 * @returns The JSON text to store as the archive's `.obsidian/app.json`.
 */
export function buildArchivedDemoVaultAppJsonContent(params: BuildArchivedDemoVaultAppJsonContentParams): string {
  return `${
    toJson({
      ...params.appJson,
      ...DEMO_VAULT_APP_JSON_SETTINGS
    })
  }\n`;
}

/**
 * Finds the owned settings a demo vault has committed. They belong to this package, which injects them at
 * release time, so a committed one is drift waiting to happen rather than a local preference.
 *
 * @param params - The parameters for the lookup.
 * @returns The names of the owned settings present in the committed `app.json`, in the order they are
 * declared in {@link DEMO_VAULT_APP_JSON_SETTINGS}.
 */
export function findOwnedDemoVaultAppJsonSettings(params: FindOwnedDemoVaultAppJsonSettingsParams): string[] {
  return Object.keys(DEMO_VAULT_APP_JSON_SETTINGS).filter((setting) => Object.hasOwn(params.appJson, setting));
}

/**
 * Parses a demo vault's committed `app.json`.
 *
 * @param params - The parameters for the parse.
 * @returns The parsed settings, or an empty object when the vault commits no `app.json`.
 * @throws When the content is not valid JSON, naming the file it came from.
 */
export function parseDemoVaultAppJson(params: ParseDemoVaultAppJsonParams): DemoVaultAppJson {
  if (params.content === null) {
    return {};
  }

  try {
    return JSON.parse(params.content) as DemoVaultAppJson;
  } catch (error) {
    throw new Error(`Could not parse ${params.path}.`, { cause: error });
  }
}
