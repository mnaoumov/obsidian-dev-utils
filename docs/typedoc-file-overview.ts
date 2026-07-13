// @ts-check

/**
 * @file
 *
 * TypeDoc plugin: surface the repo's `@file` module overviews on the generated API module pages.
 *
 * The library documents every module with a top-of-file `/** @file ... *\/` block. TypeDoc only treats a
 * top-of-file comment as the module comment when it carries `@packageDocumentation` or `@module`, so a bare
 * `@file` overview is otherwise dropped and the module page gets no description. This plugin re-reads each
 * module's source, extracts the `@file` overview, and assigns it as the module reflection's comment so it is
 * migrated into the site.
 */

import { readFileSync } from 'node:fs';

import type { Application } from 'typedoc';

import {
  Comment,
  Converter,
  ReflectionKind
} from 'typedoc';

/**
 * Registers the plugin with the TypeDoc application.
 *
 * @param app - The TypeDoc application.
 */
export function load(app: Application): void {
  // Register `@file` as a modifier tag so TypeDoc stops warning about an unknown block tag. Read the current
  // (default-populated) value and append, so none of the built-in modifier tags are lost. Done at
  // `EVENT_BEGIN` so it applies after all option readers have run, before comments are parsed.
  app.converter.on(Converter.EVENT_BEGIN, () => {
    const modifierTags = app.options.getValue('modifierTags');
    if (!modifierTags.includes('@file')) {
      app.options.setValue('modifierTags', [...modifierTags, '@file']);
    }
  });

  app.converter.on(Converter.EVENT_RESOLVE, (_context, reflection) => {
    if (!reflection.kindOf(ReflectionKind.Module) || reflection.comment) {
      return;
    }

    const fileName = reflection.sources?.[0]?.fullFileName;
    if (!fileName) {
      return;
    }

    let source: string;
    try {
      source = readFileSync(fileName, 'utf8');
    } catch {
      return;
    }

    const overview = extractFileOverview(source);
    if (overview) {
      reflection.comment = new Comment([{ kind: 'text', text: overview }]);
    }
  });
}

/**
 * Extracts the description of a leading `@file` block comment.
 *
 * @param source - The full source text of the module.
 * @returns The `@file` overview description, or an empty string when absent.
 */
function extractFileOverview(source: string): string {
  const match = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) {
    return '';
  }

  const raw = match[1] ?? '';
  if (!/@file\b/.test(raw)) {
    return '';
  }

  const lines = raw.split('\n').map((line) => line.replace(/^\s*\*? ?/, ''));
  const fileIndex = lines.findIndex((line) => /@file\b/.test(line));
  if (fileIndex === -1) {
    return '';
  }

  return [
    (lines[fileIndex] ?? '').replace(/@file\b/, '').trim(),
    ...lines.slice(fileIndex + 1)
  ].join('\n').trim();
}
