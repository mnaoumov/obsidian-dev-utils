import { RuleTester } from 'eslint';
import {
  describe,
  it
} from 'vitest';

import { jsonPlugin } from './manifest-helpers.ts';
import {
  manifestSchema,
  MESSAGE_ID_DISALLOWED_KEY,
  MESSAGE_ID_DUPLICATE_KEY,
  MESSAGE_ID_EMPTY_FUNDING_URL,
  MESSAGE_ID_INVALID_FUNDING_URL,
  MESSAGE_ID_INVALID_TYPE,
  MESSAGE_ID_MISSING_KEY,
  MESSAGE_ID_MUST_BE_ROOT_OBJECT
} from './manifest-schema.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  language: 'json/json',
  plugins: { json: jsonPlugin }
});

const RELEASED_MANIFEST = `{
  "author": "mnaoumov",
  "authorUrl": "https://github.com/mnaoumov/",
  "description": "Does something useful.",
  "fundingUrl": "https://www.buymeacoffee.com/mnaoumov",
  "id": "does-something",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "Does Something",
  "version": "1.0.0"
}`;

ruleTester.run('manifest-schema', manifestSchema, {
  invalid: [
    {
      code: '[]',
      errors: [{ messageId: MESSAGE_ID_MUST_BE_ROOT_OBJECT }],
      name: 'top-level value is not an object'
    },
    {
      code: `{
  "author": "a",
  "author": "b",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_DUPLICATE_KEY }],
      name: 'the same key twice'
    },
    {
      code: `{
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_MISSING_KEY }],
      name: 'a required key is missing'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_MISSING_KEY }],
      name: 'a released plugin without minAppVersion'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "name": "X"
}`,
      errors: [
        { messageId: MESSAGE_ID_MISSING_KEY },
        { messageId: MESSAGE_ID_MISSING_KEY }
      ],
      name: 'no version at all, so minAppVersion is required too'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": 1
}`,
      errors: [{ messageId: MESSAGE_ID_INVALID_TYPE }],
      name: 'a non-string version still counts as released'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "extraKey": "x",
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_DISALLOWED_KEY }],
      name: 'a key the directory does not allow'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": "yes",
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_INVALID_TYPE }],
      name: 'a value of the wrong type'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "fundingUrl": "",
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_EMPTY_FUNDING_URL }],
      name: 'an empty fundingUrl string'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "fundingUrl": {},
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_EMPTY_FUNDING_URL }],
      name: 'an empty fundingUrl object'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "fundingUrl": { "Buy Me a Coffee": 1 },
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_INVALID_FUNDING_URL }],
      name: 'a non-string value inside a fundingUrl object'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "fundingUrl": { "Buy Me a Coffee": "" },
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      errors: [{ messageId: MESSAGE_ID_EMPTY_FUNDING_URL }],
      name: 'an empty string inside a fundingUrl object'
    }
  ],
  valid: [
    {
      code: RELEASED_MANIFEST,
      name: 'a complete released manifest'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "id": "x",
  "isDesktopOnly": false,
  "name": "X",
  "version": "0.0.0"
}`,
      name: 'an unreleased plugin, whose minAppVersion is written at first release'
    },
    {
      code: `{
  "author": "a",
  "description": "Does something useful.",
  "fundingUrl": { "Buy Me a Coffee": "https://www.buymeacoffee.com/mnaoumov" },
  "id": "x",
  "isDesktopOnly": false,
  "minAppVersion": "1.13.7",
  "name": "X",
  "version": "1.0.0"
}`,
      name: 'a fundingUrl object of string values'
    }
  ]
});
