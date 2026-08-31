/**
 * @file
 *
 * The slice of Templater's INTERNAL API this library talks to, and the runtime narrowing that gets hold
 * of it.
 *
 * **Templater publishes no API.** Rendering a template against a file and getting the resulting string
 * back is only reachable through undocumented internals hanging off
 * `app.plugins.getPlugin('templater-obsidian').templater` — `create_running_config`,
 * `functions_generator.generate_object`, `read_and_parse_template`, and a `RunMode` enum. Every plugin
 * that wants it re-derives the same reverse engineering, which is why it lives here instead.
 *
 * **This module is explicitly BEST-EFFORT.** Nothing it binds to is documented or covered by Templater's
 * semantic versioning, so a Templater release may rename or reshape any of it without warning. The shapes
 * below were read from Templater `2.24.3`. Two deliberate consequences follow:
 *
 * - {@link resolveTemplaterApi} returns `null` — a Templater too old, too new or too broken to talk to
 *   reads as "not there" and the integration stays dormant.
 * - {@link requireTemplaterApi} throws a {@link TemplaterUnavailableError} that NAMES the plugin and the
 *   reason, rather than letting a `Cannot read properties of undefined` surface from somewhere inside
 *   Templater.
 *
 * The types are DECLARED HERE rather than imported, and narrowed to the members actually called: Templater
 * ships no npm types package, and depending on it would turn an optional integration into a build-time
 * dependency (see rule L9).
 *
 * The second thing this module supplies is an active-file answer. While a template renders,
 * `app.workspace.getActiveFile()` still points at whatever the user happens to have open — NOT at the file
 * the template is being rendered for — so a plugin's own helper called from inside a template resolves
 * links against the wrong note. {@link TemplaterActiveFileProvider} answers with the render target for the
 * duration of a {@link parseTemplate} call and falls back to the workspace otherwise. Note this is about
 * the CONSUMER's helpers: Templater's own `tp.file.*` already resolves through the running config's
 * `target_file` and needs no help.
 */

import type {
  App,
  TFile
} from 'obsidian';

import type { PathOrFile } from './file-system.ts';

import { AppActiveFileProvider } from './active-file-provider.ts';
import { getFile } from './file-system.ts';

/**
 * Parameters for {@link getTemplaterFunctions}.
 */
export interface GetTemplaterFunctionsParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * Whether to return Templater's `current_functions_object` when it already has one, instead of
   * generating a fresh object. Reuse is cheaper and gives the object of the render currently in flight;
   * pass `false` to force a new one built for `targetPathOrFile`.
   *
   * @default `true`
   */
  readonly shouldReuseCurrent?: boolean;

  /**
   * The file the generated functions should resolve against — what `tp.file.*` reports.
   */
  readonly targetPathOrFile: PathOrFile;
}

/**
 * Parameters for {@link parseTemplate}.
 */
export interface ParseTemplateParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The file the template is rendered FOR. It is what `tp.file.*` resolves to inside the template, and
   * what {@link TemplaterActiveFileProvider} reports for the duration of the call.
   */
  readonly targetPathOrFile: PathOrFile;

  /**
   * The template file to render.
   */
  readonly templatePathOrFile: PathOrFile;
}

/**
 * Templater's internal API object, narrowed to the members this library calls.
 *
 * Its members are `snake_case` because Templater's are; they are transcribed rather than renamed so the
 * shape can be checked against Templater's source at a glance.
 */
export interface TemplaterApi {
  /**
   * Builds the {@link TemplaterRunningConfig} that describes one render.
   *
   * @param templateFile - The template being rendered, or `undefined` when there is none (as when only
   * the functions object is wanted).
   * @param targetFile - The file the render is for.
   * @param runMode - Which {@link TemplaterRunMode} the render is.
   * @returns The running config.
   */
  create_running_config(templateFile: TFile | undefined, targetFile: TFile, runMode: TemplaterRunMode): TemplaterRunningConfig;

  /**
   * The functions object (`tp`) of the render currently in flight, when there is one.
   */
  current_functions_object?: object | undefined;

  /**
   * Builds the functions object (`tp`) a template is evaluated against.
   */
  functions_generator: TemplaterFunctionsGenerator;

  /**
   * Reads the config's `template_file` and renders it, returning the resulting text.
   *
   * @param config - The {@link TemplaterRunningConfig} describing the render. Templater throws when its
   * `template_file` is not a `TFile`.
   * @returns A {@link Promise} resolving to the rendered text.
   */
  read_and_parse_template(config: TemplaterRunningConfig): Promise<string>;
}

/**
 * The `functions_generator` half of {@link TemplaterApi}.
 */
export interface TemplaterFunctionsGenerator {
  /**
   * Builds the functions object (`tp`) for a running config.
   *
   * @param config - The {@link TemplaterRunningConfig} to build for.
   * @returns A {@link Promise} resolving to the functions object.
   */
  generate_object(config: TemplaterRunningConfig): Promise<object>;
}

/**
 * One Templater render, as Templater's `create_running_config` describes it.
 *
 * Its members are `snake_case` because Templater's are.
 */
export interface TemplaterRunningConfig {
  /**
   * The file Templater considers active. Templater fills this in itself from
   * `workspace.activeEditor?.file ?? workspace.getActiveFile()`; it is optional here because a
   * hand-built config may omit it.
   */
  active_file?: null | TFile | undefined;

  /**
   * Which {@link TemplaterRunMode} the render is.
   */
  run_mode: TemplaterRunMode;

  /**
   * The file the render is for — what `tp.file.*` resolves to.
   */
  target_file: TFile;

  /**
   * The template being rendered, when there is one.
   */
  template_file?: TFile | undefined;
}

/**
 * Templater's plugin id, as its manifest declares it.
 */
export const TEMPLATER_PLUGIN_ID = 'templater-obsidian';

/* eslint-disable no-magic-numbers -- These are Templater's own `RunMode` values, transcribed. */
/**
 * Templater's `RunMode` enum, which says what kind of render a {@link TemplaterRunningConfig} describes.
 *
 * The numeric values ARE Templater's, and the members are listed in its declaration order so the two can
 * be compared line for line. They are written out explicitly all the same, because they cross into
 * Templater as integers — never renumber them.
 */
export enum TemplaterRunMode {
  /**
   * Render the template into a newly created file.
   */
  CreateNewFromTemplate = 0,

  /**
   * Render the template and append the result to the active file.
   */
  AppendActiveFile = 1,

  /**
   * Render the template and overwrite a given file with the result.
   */
  OverwriteFile = 2,

  /**
   * Render the template and overwrite the active file with the result.
   */
  OverwriteActiveFile = 3,

  /**
   * Render the template on demand, for a caller that wants the resulting text rather than a file
   * written. This is what {@link parseTemplate} uses.
   */
  DynamicProcessor = 4,

  /**
   * Render the template as a startup template. {@link getTemplaterFunctions} uses it for the throwaway
   * config it builds, because that config renders nothing.
   */
  StartupTemplate = 5
}
/* eslint-enable no-magic-numbers -- These are Templater's own `RunMode` values, transcribed. */

/**
 * Why Templater's internal API could not be handed over.
 */
export enum TemplaterUnavailabilityReason {
  /**
   * Templater is not installed, or is installed but disabled. Obsidian's `getPlugin` cannot tell the two
   * apart — it returns nothing either way.
   */
  NotLoaded = 'notLoaded',

  /**
   * Templater is loaded, but does not expose the internals this library calls — it is too old, too new,
   * or has been reshaped.
   */
  ShapeChanged = 'shapeChanged'
}

/**
 * Active-file provider that answers with the file a {@link parseTemplate} render is currently for,
 * falling back to the workspace's active file when no render is in flight.
 *
 * This is the piece that makes a consumer's own template helpers resolve against the right note: during a
 * render the workspace still has whatever the user was looking at open, which is rarely the target.
 */
export class TemplaterActiveFileProvider extends AppActiveFileProvider {
  /**
   * Gets the file the innermost in-flight {@link parseTemplate} render is for, or the workspace's active
   * file when there is no render in flight.
   *
   * @returns The active file, or `null` if there is none.
   */
  public override getActiveFile(): null | TFile {
    return getTemplaterRenderTargetFile() ?? super.getActiveFile();
  }
}

/**
 * Thrown when Templater's internal API cannot be handed over, carrying the
 * {@link TemplaterUnavailabilityReason} that says why.
 */
export class TemplaterUnavailableError extends Error {
  /**
   * Which of the two failures occurred.
   */
  public readonly reason: TemplaterUnavailabilityReason;

  /**
   * Creates a {@link TemplaterUnavailableError}.
   *
   * @param reason - Why the API is unavailable.
   */
  public constructor(reason: TemplaterUnavailabilityReason) {
    super(`The internal API of the plugin "${TEMPLATER_PLUGIN_ID}" is unavailable: ${reason}.`);
    this.name = 'TemplaterUnavailableError';
    this.reason = reason;
  }
}

/**
 * Gets Templater's functions object — the `tp` a template is evaluated against — so a caller can invoke
 * `tp.date.now()`, `tp.file.title` and the rest outside a template.
 *
 * @param params - The {@link GetTemplaterFunctionsParams}.
 * @returns A {@link Promise} resolving to the functions object.
 * @throws A {@link TemplaterUnavailableError} when Templater is not loaded or its shape has changed.
 */
export async function getTemplaterFunctions(params: GetTemplaterFunctionsParams): Promise<object> {
  const {
    app,
    shouldReuseCurrent = true,
    targetPathOrFile
  } = params;
  const api = requireTemplaterApi(app);

  if (shouldReuseCurrent && api.current_functions_object) {
    return api.current_functions_object;
  }

  const targetFile = getFile({
    app,
    pathOrFile: targetPathOrFile
  });
  const config = api.create_running_config(undefined, targetFile, TemplaterRunMode.StartupTemplate);
  return await api.functions_generator.generate_object(config);
}

/**
 * Gets the file the innermost in-flight {@link parseTemplate} render is for.
 *
 * Renders nest — a template may render another — so the calls form a stack and this reports the top of
 * it. Outside any render it is `null`.
 *
 * @returns The render target, or `null` when no render is in flight.
 */
export function getTemplaterRenderTargetFile(): null | TFile {
  return renderTargetFiles.at(-1) ?? null;
}

/**
 * Renders a Templater template against a target file and returns the resulting text, without writing
 * anything.
 *
 * For the duration of the call {@link getTemplaterRenderTargetFile} and
 * {@link TemplaterActiveFileProvider} report `targetPathOrFile`, so a consumer's own helpers invoked from
 * inside the template resolve against it rather than against whatever the user has open.
 *
 * @param params - The {@link ParseTemplateParams}.
 * @returns A {@link Promise} resolving to the rendered text.
 * @throws A {@link TemplaterUnavailableError} when Templater is not loaded or its shape has changed.
 */
export async function parseTemplate(params: ParseTemplateParams): Promise<string> {
  const {
    app,
    targetPathOrFile,
    templatePathOrFile
  } = params;
  const templateFile = getFile({
    app,
    pathOrFile: templatePathOrFile
  });
  const targetFile = getFile({
    app,
    pathOrFile: targetPathOrFile
  });
  const api = requireTemplaterApi(app);

  renderTargetFiles.push(targetFile);
  try {
    return await api.read_and_parse_template({
      // eslint-disable-next-line camelcase -- Templater API.
      run_mode: TemplaterRunMode.DynamicProcessor,
      // eslint-disable-next-line camelcase -- Templater API.
      target_file: targetFile,
      // eslint-disable-next-line camelcase -- Templater API.
      template_file: templateFile
    });
  } finally {
    renderTargetFiles.pop();
  }
}

/**
 * Gets Templater's internal API, throwing when it cannot be had.
 *
 * Use this where the caller cannot carry on without Templater — the error names the plugin and says which
 * of the two failures occurred. Use {@link resolveTemplaterApi} instead where the integration is optional.
 *
 * @param app - The Obsidian app instance.
 * @returns Templater's internal API.
 * @throws A {@link TemplaterUnavailableError} when Templater is not loaded or its shape has changed.
 */
export function requireTemplaterApi(app: App): TemplaterApi {
  if (!app.plugins.getPlugin(TEMPLATER_PLUGIN_ID)) {
    throw new TemplaterUnavailableError(TemplaterUnavailabilityReason.NotLoaded);
  }

  const api = resolveTemplaterApi(app);
  if (!api) {
    throw new TemplaterUnavailableError(TemplaterUnavailabilityReason.ShapeChanged);
  }

  return api;
}

/**
 * Gets Templater's internal API, when Templater is installed, enabled and still the shape this library
 * expects.
 *
 * @param app - The Obsidian app instance.
 * @returns The internal API, or `null` when Templater is not there to talk to.
 */
export function resolveTemplaterApi(app: App): null | TemplaterApi {
  const plugin = app.plugins.getPlugin(TEMPLATER_PLUGIN_ID);
  if (!plugin || !('templater' in plugin)) {
    return null;
  }

  const templater: unknown = plugin.templater;
  return isTemplaterApi(templater) ? templater : null;
}

/*
 * The stack of files in-flight `parseTemplate` calls are rendering for, innermost last. A stack rather
 * than a single slot because a template may render another, and an array rather than a reassigned
 * variable because pushing and popping a `const` needs no write to an outer binding across an `await`.
 */
const renderTargetFiles: TFile[] = [];

/**
 * Checks that a value is Templater's internal API, by the members this library actually calls.
 *
 * A predicate rather than a cast on purpose: `templater` is not part of Obsidian's `Plugin` type, so the
 * value arrives as `unknown` and the only honest way to type it is to VERIFY it. A Templater that renames
 * one of these therefore reads as "not there", instead of throwing from inside a render.
 *
 * @param value - The candidate `templater` object.
 * @returns Whether it carries every member this library calls.
 */
function isTemplaterApi(value: unknown): value is TemplaterApi {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('create_running_config' in value) || typeof value.create_running_config !== 'function') {
    return false;
  }

  if (!('read_and_parse_template' in value) || typeof value.read_and_parse_template !== 'function') {
    return false;
  }

  if (!('functions_generator' in value)) {
    return false;
  }

  const functionsGenerator: unknown = value.functions_generator;
  if (typeof functionsGenerator !== 'object' || functionsGenerator === null) {
    return false;
  }

  return 'generate_object' in functionsGenerator && typeof functionsGenerator.generate_object === 'function';
}
