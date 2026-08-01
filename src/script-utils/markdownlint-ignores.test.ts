import {
  describe,
  expect,
  it
} from 'vitest';

import {
  checkIsInNodeModules,
  NODE_MODULES_IGNORE_GLOB
} from './linters/markdownlint-ignores.ts';

describe('NODE_MODULES_IGNORE_GLOB', () => {
  it('should match a node_modules folder at any depth', () => {
    expect(NODE_MODULES_IGNORE_GLOB).toBe('**/node_modules/**');
  });
});

describe('checkIsInNodeModules', () => {
  it('should match a top-level node_modules path', () => {
    expect(checkIsInNodeModules('node_modules/uuid/README.md')).toBe(true);
  });

  // The live case: `obsidian-codescript-toolkit` re-includes this tree in `.gitignore` on purpose, so
  // Git reports it and only this filter can drop it.
  it('should match a vendored node_modules path nested several folders deep', () => {
    expect(checkIsInNodeModules('demo-vault/_assets/CodeScriptToolkit/node_modules/uuid/README.md')).toBe(true);
  });

  it('should match a nested node_modules inside another node_modules', () => {
    expect(checkIsInNodeModules('node_modules/a/node_modules/b/README.md')).toBe(true);
  });

  it('should not match an ordinary path', () => {
    expect(checkIsInNodeModules('docs/guide.md')).toBe(false);
  });

  // Segment matching, not substring matching — a real file must not be swept up by its name.
  it('should not match a file whose own name contains the words', () => {
    expect(checkIsInNodeModules('docs/node_modules-migration.md')).toBe(false);
  });

  it('should not match a folder whose name merely starts with the words', () => {
    expect(checkIsInNodeModules('node_modules_backup/README.md')).toBe(false);
  });

  it('should not match a root-level file', () => {
    expect(checkIsInNodeModules('README.md')).toBe(false);
  });
});
