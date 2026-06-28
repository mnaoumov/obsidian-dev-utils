/**
 * @file
 *
 * This module provides utility functions for processing Markdown content in Obsidian.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type {
  DomEventsHandlers,
  DomEventsHandlersInfo,
  EmbedRegistryEmbedByExtensionRecord
} from '@obsidian-typings/obsidian-public-latest';
import type { ExtractConstructor } from '@obsidian-typings/obsidian-public-latest/implementations';
import type { App } from 'obsidian';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Component,
  HoverPopover,
  MarkdownPreviewRenderer,
  MarkdownRenderer
} from 'obsidian';

import type { PathOrAbstractFile } from './file-system.ts';

import { invokeAsyncSafely } from '../async.ts';
import {
  getZIndex,
  waitUntilConnected
} from '../html-element.ts';
import { normalizeOptionalProperties } from '../object-utils.ts';
import { MonkeyAroundComponent } from './components/monkey-around-component.ts';
import { getDomEventsHandlersConstructor } from './constructors/getDomEventsHandlersConstructor.ts';
import {
  getAbstractFileOrNull,
  getPath,
  isFolder
} from './file-system.ts';

type DomEventsHandlersConstructor = ExtractConstructor<DomEventsHandlers>;

let domEventsHandlersConstructor: DomEventsHandlersConstructor | null = null;

/**
 * The params for the full render.
 */
export interface FullRenderParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The Component instance to use for the render.
   */
  readonly component?: Component;

  /**
   * The HTMLElement to render to.
   */
  readonly el: HTMLElement;

  /**
   * The Markdown string to render.
   */
  readonly markdown: string;

  /**
   * Whether to register link handlers for the rendered element.
   *
   * @default `false`
   */
  readonly shouldRegisterLinkHandlers?: boolean;

  /**
   * The source path to resolve relative links.
   *
   * @default `'/'`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link markdownToHtml}.
 */
export interface MarkdownToHtmlParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The Markdown string to convert.
   */
  readonly markdown: string;

  /**
   * The source path to resolve relative links.
   *
   * @default `''`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link registerLinkHandlers}.
 */
export interface RegisterLinkHandlersParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The HTMLElement to register link handlers for.
   */
  readonly el: HTMLElement;

  /**
   * The source path to resolve relative links from.
   *
   * @default `''`
   */
  readonly sourcePath?: string;
}

/**
 * Parameters for {@link renderExternalLink}.
 */
export interface RenderExternalLinkParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The text to display for the external link.
   */
  readonly displayText?: string;

  /**
   * The URL to render the external link for.
   */
  readonly url: string;
}

/**
 * Parameters for {@link renderInternalLink}.
 */
export interface RenderInternalLinkParams {
  /**
   * The Obsidian app instance.
   */
  readonly app: App;

  /**
   * The text to display for the internal link.
   */
  readonly displayText?: string;

  /**
   * The path or abstract file to render the internal link for.
   */
  readonly pathOrAbstractFile: PathOrAbstractFile;
}

interface FixedZIndexDomEventsHandlersInfoConstructorParams {
  readonly app: App;
  readonly el: HTMLElement;
  readonly path: string;
}

class EmbedByExtensionMdPatchComponent extends MonkeyAroundComponent {
  public constructor(private readonly embedByExtension: EmbedRegistryEmbedByExtensionRecord) {
    super();
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'md',
      obj: this.embedByExtension,
      patchHandler: ({
        fallback,
        originalArgs: [context]
      }) => {
        context.displayMode = false;
        return fallback();
      }
    });
  }
}

class FixedZIndexDomEventsHandlersInfo implements DomEventsHandlersInfo {
  public readonly app: App;
  public readonly path: string;
  public get hoverPopover(): HoverPopover | null {
    return this._hoverPopover;
  }

  public set hoverPopover(hoverPopover: HoverPopover | null) {
    this._hoverPopover = hoverPopover;
    if (hoverPopover && this.zIndex !== undefined) {
      hoverPopover.hoverEl.setCssStyles({
        zIndex: String(this.zIndex)
      });
    }
  }

  private _hoverPopover: HoverPopover | null = null;

  private readonly el: HTMLElement;

  private zIndex?: number;

  public constructor(params: FixedZIndexDomEventsHandlersInfoConstructorParams) {
    this.app = params.app;
    this.path = params.path;
    this.el = params.el;

    invokeAsyncSafely(async () => {
      await waitUntilConnected(this.el);
      this.updateZIndex(this.el);
    });
  }

  private updateZIndex(el: HTMLElement): void {
    this.zIndex = getZIndex(el) + 1;
  }
}

/**
 * Render the markdown and embeds.
 *
 * @param params - The parameters for the full render.
 * @returns The {@link Promise} that resolves when the full render is complete.
 */
export async function fullRender(params: FullRenderParams): Promise<void> {
  const sourcePath = params.sourcePath ?? '/';
  let shouldUnloadComponent = false;
  let component: Component;
  if (params.component) {
    component = params.component;
  } else {
    component = new Component();
    component.load();
    shouldUnloadComponent = true;
  }

  using _ = component.addChild(new EmbedByExtensionMdPatchComponent(params.app.embedRegistry.embedByExtension));

  await MarkdownRenderer.render(params.app, params.markdown, params.el, sourcePath, component);

  if (shouldUnloadComponent) {
    component.unload();
  }

  if (params.shouldRegisterLinkHandlers) {
    await registerLinkHandlers(normalizeOptionalProperties<RegisterLinkHandlersParams>({
      app: params.app,
      el: params.el,
      sourcePath: params.sourcePath
    }));
  }
}

/**
 * Converts Markdown to HTML.
 *
 * @param params - The parameters for the conversion.
 * @returns The HTML string.
 */
export async function markdownToHtml(params: MarkdownToHtmlParams): Promise<string> {
  const {
    app,
    markdown,
    sourcePath
  } = params;
  const component = new Component();
  component.load();
  const renderDiv = createDiv();
  await MarkdownRenderer.render(app, markdown, renderDiv, sourcePath ?? '', component);
  const html = renderDiv.innerHTML;
  component.unload();
  return html;
}

/**
 * Registers link handlers for the given element.
 *
 * @param params - The parameters for registering link handlers.
 */
export async function registerLinkHandlers(params: RegisterLinkHandlersParams): Promise<void> {
  const {
    app,
    el,
    sourcePath
  } = params;
  // eslint-disable-next-line require-atomic-updates -- No race condition.
  domEventsHandlersConstructor ??= await getDomEventsHandlersConstructor(app);
  MarkdownPreviewRenderer.registerDomEvents(
    el,
    new domEventsHandlersConstructor(
      new FixedZIndexDomEventsHandlersInfo({
        app,
        el,
        path: sourcePath ?? ''
      })
    )
  );
}

/**
 * Renders an external link.
 *
 * @param params - The parameters for rendering the external link.
 * @returns The HTMLAnchorElement containing the rendered external link.
 */
export async function renderExternalLink(params: RenderExternalLinkParams): Promise<HTMLAnchorElement> {
  const {
    app,
    url
  } = params;
  const displayText = params.displayText ?? url;
  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[${displayText}](${url})`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  await registerLinkHandlers({
    app,
    el: aEl
  });
  return aEl;
}

/**
 * Renders an internal link.
 *
 * @param params - The parameters for rendering the internal link.
 * @returns The HTMLAnchorElement containing the rendered internal link.
 */
export async function renderInternalLink(params: RenderInternalLinkParams): Promise<HTMLAnchorElement> {
  const {
    app,
    pathOrAbstractFile
  } = params;
  const abstractFile = getAbstractFileOrNull({ app, pathOrFile: pathOrAbstractFile });
  const path = getPath(app, pathOrAbstractFile);
  const displayText = params.displayText ?? path;
  if (isFolder(abstractFile)) {
    return createEl('a', { text: displayText }, (aEl) => {
      aEl.addEventListener('click', (evt) => {
        evt.preventDefault();
        app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer)?.revealInFolder(abstractFile);
      });
    });
  }

  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[[${path}|${displayText}]]`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  await registerLinkHandlers({
    app,
    el: aEl
  });
  return aEl;
}

/* v8 ignore stop */
