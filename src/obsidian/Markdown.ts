/**
 * @packageDocumentation
 *
 * This module provides utility functions for processing Markdown content in Obsidian.
 */

import type { App } from 'obsidian';
import type {
  DomEventsHandlersConstructor,
  DomEventsHandlersInfo,
  EmbedCreator
} from 'obsidian-typings';

import {
  Component,
  HoverPopover,
  MarkdownPreviewRenderer,
  MarkdownRenderer
} from 'obsidian';

import type { PathOrFile } from './FileSystem.ts';

import { getZIndex } from '../HTMLElement.ts';
import { getPath } from './FileSystem.ts';
import { invokeWithPatchAsync } from './MonkeyAround.ts';

let domEventsHandlersConstructor: DomEventsHandlersConstructor | null = null;

/**
 * The options for the full render.
 */
export interface FullRenderOptions {
  /**
   * The Obsidian app instance.
   */
  app: App;

  /**
   * The Component instance to use for the render.
   */
  component?: Component;

  /**
   * The HTMLElement to render to.
   */
  el: HTMLElement;

  /**
   * The Markdown string to render.
   */
  markdown: string;

  /**
   * Whether to register link handlers for the rendered element.
   */
  shouldRegisterLinkHandlers?: boolean;

  /**
   * The source path to resolve relative links.
   */
  sourcePath?: string;
}

type RegisterDomEventsFn = typeof MarkdownPreviewRenderer.registerDomEvents;

class FixedZIndexDomEventsHandlersInfo implements DomEventsHandlersInfo {
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

  private zIndex?: number;

  public constructor(public readonly app: App, public readonly path: string, el: HTMLElement) {
    if (el.isConnected) {
      this.updateZIndex(el);
    } else {
      el.onNodeInserted(() => {
        this.updateZIndex(el);
      });
    }
  }

  private updateZIndex(el: HTMLElement): void {
    this.zIndex = getZIndex(el) + 1;
  }
}

/**
 * Render the markdown and embeds.
 *
 * @param options - The options for the full render.
 * @returns The {@link Promise} that resolves when the full render is complete.
 */
export async function fullRender(options: FullRenderOptions): Promise<void> {
  const sourcePath = options.sourcePath ?? '/';
  let shouldUnloadComponent = false;
  let component: Component;
  if (options.component) {
    component = options.component;
  } else {
    component = new Component();
    component.load();
    shouldUnloadComponent = true;
  }
  await invokeWithPatchAsync(options.app.embedRegistry.embedByExtension, {
    md: (next: EmbedCreator): EmbedCreator => (context, file, subpath) => {
      context.displayMode = false;
      return next(context, file, subpath);
    }
  }, async () => {
    await MarkdownRenderer.render(options.app, options.markdown, options.el, sourcePath, component);
  });

  if (shouldUnloadComponent) {
    component.unload();
  }

  if (options.shouldRegisterLinkHandlers) {
    await registerLinkHandlers(options.app, options.el, options.sourcePath);
  }
}

/**
 * Converts Markdown to HTML.
 *
 * @param app - The Obsidian app instance.
 * @param markdown - The Markdown string to convert.
 * @param sourcePath - (optional) The source path to resolve relative links.
 * @returns The HTML string.
 */
export async function markdownToHtml(app: App, markdown: string, sourcePath?: string): Promise<string> {
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
 * @param app - The Obsidian app instance.
 * @param el - The HTMLElement to register link handlers for.
 * @param sourcePath - The source path to resolve relative links from.
 */
export async function registerLinkHandlers(app: App, el: HTMLElement, sourcePath?: string): Promise<void> {
  // eslint-disable-next-line require-atomic-updates -- No race condition.
  domEventsHandlersConstructor ??= await getDomEventsHandlersConstructor(app);
  MarkdownPreviewRenderer.registerDomEvents(
    el,
    new domEventsHandlersConstructor(new FixedZIndexDomEventsHandlersInfo(app, sourcePath ?? '', el))
  );
}

/**
 * Renders an external link.
 *
 * @param app - The Obsidian app instance.
 * @param url - The URL to render the external link for.
 * @param displayText - The text to display for the external link.
 * @returns The HTMLAnchorElement containing the rendered external link.
 */
export async function renderExternalLink(app: App, url: string, displayText?: string): Promise<HTMLAnchorElement> {
  displayText ??= url;
  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[${displayText}](${url})`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  await registerLinkHandlers(app, aEl);
  return aEl;
}

/**
 * Renders an internal link.
 *
 * @param app - The Obsidian app instance.
 * @param pathOrFile - The path or file to render the internal link for.
 * @param displayText - The text to display for the internal link.
 * @returns The HTMLAnchorElement containing the rendered internal link.
 */
export async function renderInternalLink(app: App, pathOrFile: PathOrFile, displayText?: string): Promise<HTMLAnchorElement> {
  const path = getPath(app, pathOrFile);
  displayText ??= path;
  const wrapperEl = createSpan();
  await fullRender({
    app,
    el: wrapperEl,
    markdown: `[[${path}|${displayText}]]`
  });
  const aEl = wrapperEl.find('a') as HTMLAnchorElement;
  await registerLinkHandlers(app, aEl);
  return aEl;
}

async function getDomEventsHandlersConstructor(app: App): Promise<DomEventsHandlersConstructor> {
  let mdFile = app.vault.getMarkdownFiles()[0];
  let shouldDelete = false;
  if (!mdFile) {
    // eslint-disable-next-line require-atomic-updates -- No race condition.
    mdFile = await app.vault.create('__temp.md', '');
    shouldDelete = true;
  }
  let ctor: DomEventsHandlersConstructor | null = null;
  try {
    await invokeWithPatchAsync(MarkdownPreviewRenderer, {
      registerDomEvents: (next: RegisterDomEventsFn): RegisterDomEventsFn => {
        return (el, handlers, childElFn) => {
          ctor = handlers.constructor as DomEventsHandlersConstructor;
          next(el, handlers, childElFn);
        };
      }
    }, async () => {
      const leaf = app.workspace.getLeaf(true);
      await leaf.openLinkText(mdFile.path, '');
      leaf.detach();
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Check is required as TypeScript compiler cannot know that ctor is initialized.
    if (!ctor) {
      throw new Error('Failed to get register dom events handlers constructor');
    }
    return ctor;
  } finally {
    if (shouldDelete) {
      await app.fileManager.trashFile(mdFile);
    }
  }
}
