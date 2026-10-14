import { RuleTester } from 'eslint';
import {
  describe,
  it
} from 'vitest';

import { jsonPlugin } from './manifest-helpers.ts';
import {
  manifestId,
  MESSAGE_ID_CONTAINS_OBSIDIAN,
  MESSAGE_ID_ENDS_WITH_PLUGIN,
  MESSAGE_ID_INVALID_CHARACTERS
} from './manifest-id.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  language: 'json/json',
  plugins: { json: jsonPlugin }
});

ruleTester.run('manifest-id', manifestId, {
  invalid: [
    {
      code: '{ "id": "Advanced_Exclude" }',
      errors: [{ messageId: MESSAGE_ID_INVALID_CHARACTERS }],
      name: 'uppercase letters and underscores'
    },
    {
      code: '{ "id": "obsidian-custom-attachment-location" }',
      errors: [{ messageId: MESSAGE_ID_CONTAINS_OBSIDIAN }],
      name: 'contains obsidian'
    },
    {
      code: '{ "id": "smart-rename-plugin" }',
      errors: [{ messageId: MESSAGE_ID_ENDS_WITH_PLUGIN }],
      name: 'ends with plugin'
    }
  ],
  valid: [
    {
      code: '{ "id": "advanced-note-composer" }',
      name: 'lowercase letters and hyphens'
    },
    {
      code: '{ "name": "No Id Here" }',
      name: 'no id at all, which manifest-schema reports instead'
    },
    {
      code: '{ "id": 1 }',
      name: 'a non-string id, whose type manifest-schema reports instead'
    },
    {
      code: '[]',
      name: 'a top-level value that is not an object'
    }
  ]
});
