/**
 * @packageDocumentation
 *
 * This module provides utility functions for processing Markdown content in Obsidian.
 */

import type { App } from 'obsidian';
import type {
  EmbedCreator,
  RegisterDomEventsHandlersConstructor
} from 'obsidian-typings';

import {
  Component,
  MarkdownPreviewRenderer,
  MarkdownRenderer
} from 'obsidian';

import { invokeWithPatchAsync } from './MonkeyAround.ts';

let registerDomEventsHandlersConstructor: null | RegisterDomEventsHandlersConstructor = null;

type RegisterDomEventsFn = typeof MarkdownPreviewRenderer.registerDomEvents;

/**
 * Render the markdown and embeds.
 *
 * @param app - The Obsidian app instance.
 * @param markdown - The Markdown string to render.
 * @param el - The HTMLElement to render to.
 * @param sourcePath - The source path to resolve relative links.
 * @param component - The Component instance.
 */
export async function fullRender(app: App, markdown: string, el: HTMLElement, sourcePath: string, component: Component): Promise<void> {
  await invokeWithPatchAsync(app.embedRegistry.embedByExtension, {
    md: (next: EmbedCreator): EmbedCreator => (context, file, subpath) => {
      context.displayMode = false;
      return next(context, file, subpath);
    }
  }, async () => {
    await MarkdownRenderer.render(app, markdown, el, sourcePath, component);
  });

  await registerLinkHandlers(app, el, sourcePath);
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
  registerDomEventsHandlersConstructor ??= await getRegisterDomEventsHandlersConstructor(app);
  MarkdownPreviewRenderer.registerDomEvents(
    el,
    new registerDomEventsHandlersConstructor({
      app,
      hoverPopover: null,
      path: sourcePath ?? ''
    })
  );
}

async function getRegisterDomEventsHandlersConstructor(app: App): Promise<RegisterDomEventsHandlersConstructor> {
  let mdFile = app.vault.getMarkdownFiles()[0];
  let shouldDelete = false;
  if (!mdFile) {
    // eslint-disable-next-line require-atomic-updates -- No race condition.
    mdFile = await app.vault.create('__temp.md', '');
    shouldDelete = true;
  }
  let ctor: null | RegisterDomEventsHandlersConstructor = null;
  try {
    await invokeWithPatchAsync(MarkdownPreviewRenderer, {
      registerDomEvents: (next: RegisterDomEventsFn): RegisterDomEventsFn => {
        return (el, handlers, childElFn) => {
          ctor = handlers.constructor as RegisterDomEventsHandlersConstructor;
          next(el, handlers, childElFn);
        };
      }
    }, async () => {
      await app.workspace.openLinkText(mdFile.path, '', true);
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
