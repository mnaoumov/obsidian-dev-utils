/**
 * @packageDocumentation
 *
 * This module extracts the `DomEventsHandlersConstructor` from Obsidian's runtime
 * by temporarily opening a markdown file in preview mode and intercepting the
 * constructor passed to `MarkdownPreviewRenderer.registerDomEvents`.
 */

/* v8 ignore start -- Deeply coupled to Obsidian runtime; requires running vault for meaningful testing. */

import type { App } from 'obsidian';
import type {
  DomEventsHandlers,
  ExtractConstructor
} from 'obsidian-typings';

import { MarkdownPreviewRenderer } from 'obsidian';

import { requestAnimationFrameAsync } from '../../async.ts';
import { assertNonNullable } from '../../type-guards.ts';
import { invokeWithPatchAsync } from '../monkey-around.ts';
import { trashSafe } from '../vault.ts';

type DomEventsHandlersConstructor = ExtractConstructor<DomEventsHandlers>;
type RegisterDomEventsFn = typeof MarkdownPreviewRenderer.registerDomEvents;

/**
 * Extracts the `DomEventsHandlersConstructor` from Obsidian's runtime.
 *
 * Opens a temporary markdown file in preview mode and intercepts the constructor
 * passed to `MarkdownPreviewRenderer.registerDomEvents`.
 *
 * @param app - The Obsidian app instance.
 * @returns A {@link Promise} that resolves to the `DomEventsHandlersConstructor`.
 */
export async function getDomEventsHandlersConstructor(app: App): Promise<DomEventsHandlersConstructor> {
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
      await leaf.openFile(mdFile, {
        active: true,
        state: { mode: 'preview' }
      });
      await requestAnimationFrameAsync();
      leaf.detach();
    });

    assertNonNullable(ctor, 'Failed to get register dom events handlers constructor');
    return ctor;
  } finally {
    if (shouldDelete) {
      await trashSafe(app, mdFile);
    }
  }
}

/* v8 ignore stop */
