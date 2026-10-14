import { RuleTester } from 'eslint';
import {
  describe,
  it
} from 'vitest';

import {
  manifestDescription,
  MESSAGE_ID_CONTAINS_OBSIDIAN,
  MESSAGE_ID_MISSING_PERIOD,
  MESSAGE_ID_NOT_CAPITALIZED,
  MESSAGE_ID_SELF_REFERENCE,
  MESSAGE_ID_TOO_LONG,
  MESSAGE_ID_TOO_SHORT
} from './manifest-description.ts';
import { jsonPlugin } from './manifest-helpers.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  language: 'json/json',
  plugins: { json: jsonPlugin }
});

const OVER_MAX_LENGTH = 251;
const TOO_LONG_DESCRIPTION = `A${'a'.repeat(OVER_MAX_LENGTH - 2)}.`;

ruleTester.run('manifest-description', manifestDescription, {
  invalid: [
    {
      code: '{ "description": "Enhances the Obsidian debugging experience." }',
      errors: [{ messageId: MESSAGE_ID_CONTAINS_OBSIDIAN }],
      name: 'contains the word Obsidian, the check no Obsidian document states'
    },
    {
      code: '{ "description": "This plugin ensures the consistency of attachments and links." }',
      errors: [{ messageId: MESSAGE_ID_SELF_REFERENCE }],
      name: 'refers to itself as `this plugin`'
    },
    {
      code: '{ "description": "This is a plugin for renaming notes." }',
      errors: [{ messageId: MESSAGE_ID_SELF_REFERENCE }],
      name: 'refers to itself as `this is a plugin`'
    },
    {
      code: '{ "description": "A plugin that renames notes." }',
      errors: [{ messageId: MESSAGE_ID_SELF_REFERENCE }],
      name: 'refers to itself as `a plugin that`'
    },
    {
      code: '{ "description": "The plugin renames notes." }',
      errors: [{ messageId: MESSAGE_ID_SELF_REFERENCE }],
      name: 'opens with `the plugin`'
    },
    {
      code: '{ "description": "Plugin for renaming notes." }',
      errors: [{ messageId: MESSAGE_ID_SELF_REFERENCE }],
      name: 'opens with `plugin`'
    },
    {
      code: '{ "description": "Renames." }',
      errors: [{ messageId: MESSAGE_ID_TOO_SHORT }],
      name: 'too short to say what the plugin does'
    },
    {
      code: JSON.stringify({ description: TOO_LONG_DESCRIPTION }),
      errors: [{ messageId: MESSAGE_ID_TOO_LONG }],
      name: 'longer than the directory allows'
    },
    {
      code: '{ "description": "renames notes keeping the previous title." }',
      errors: [{ messageId: MESSAGE_ID_NOT_CAPITALIZED }],
      name: 'does not start with a capital letter'
    },
    {
      code: '{ "description": "Renames notes keeping the previous title" }',
      errors: [{ messageId: MESSAGE_ID_MISSING_PERIOD }],
      name: 'does not end with a period'
    }
  ],
  valid: [
    {
      code: '{ "description": "Renames notes keeping the previous title in existing links." }',
      name: 'an action verb, a period, and no self-reference'
    },
    {
      code: '{ "description": "Enhances Note composer core plugin." }',
      name: 'names another plugin, which is not self-reference'
    },
    {
      code: '{ "description": "Notifies you about new app releases — not plugin updates — even when auto-update is off." }',
      name: 'mentions plugin updates, which is not self-reference'
    },
    {
      code: '{ "description": "Stores backlink cache to speed up `app.metadataCache.getBacklinksForFile()`." }',
      name: 'backticks and parentheses, which the directory accepts'
    },
    {
      code: '{ "id": "no-description-here" }',
      name: 'no description at all, which manifest-schema reports instead'
    },
    {
      code: '{ "description": 1 }',
      name: 'a non-string description, whose type manifest-schema reports instead'
    },
    {
      code: '[]',
      name: 'a top-level value that is not an object'
    }
  ]
});
