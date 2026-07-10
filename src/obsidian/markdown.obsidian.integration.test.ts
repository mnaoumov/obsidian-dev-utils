/**
 * @file
 *
 * Integration tests for the Markdown utility functions.
 * Runs against a live Obsidian instance via CLI transport.
 */

/// <reference types="obsidian-integration-testing/vitest/typings" />

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('markdown', () => {
  describe('markdownToHtml', () => {
    it('should convert simple markdown to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.markdown.markdownToHtml({ app, markdown: '**bold** and *italic*' });
        }
      });

      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should convert headings to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.markdown.markdownToHtml({ app, markdown: '# Heading 1\n## Heading 2' });
        }
      });

      expect(result).toContain('Heading 1');
      expect(result).toContain('Heading 2');
    });

    it('should convert a list to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.markdown.markdownToHtml({ app, markdown: '- item 1\n- item 2\n- item 3' });
        }
      });

      expect(result).toContain('<li');
      expect(result).toContain('item 1');
      expect(result).toContain('item 2');
      expect(result).toContain('item 3');
    });

    it('should convert inline code to HTML', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.markdown.markdownToHtml({ app, markdown: 'use `console.log()` here' });
        }
      });

      expect(result).toContain('<code>');
      expect(result).toContain('console.log()');
    });

    it('should handle empty markdown', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          return lib.obsidian.markdown.markdownToHtml({ app, markdown: '' });
        }
      });

      expect(result).toBe('');
    });
  });

  describe('fullRender', () => {
    it('should render markdown into an element', async () => {
      const result = await evalInObsidian<Record<string, never>, string>({
        async fn({ app }) {
          const lib = window.__obsidianDevUtilsModule__;
          if (!lib) {
            throw new Error('obsidian-dev-utils module not registered on window');
          }
          const el = createDiv();
          await lib.obsidian.markdown.fullRender({
            app,
            el,
            markdown: 'Hello **world**'
          });
          return el.innerHTML;
        }
      });

      expect(result).toContain('<strong>world</strong>');
      expect(result).toContain('Hello');
    });
  });
});
