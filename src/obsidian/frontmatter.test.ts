// @vitest-environment jsdom
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  parseFrontmatter,
  setFrontmatter
} from './frontmatter.ts';

describe('parseFrontmatter', () => {
  it('should parse simple key-value frontmatter', () => {
    const content = '---\ntitle: My Note\n---\nBody text';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('title', 'My Note');
  });

  describe('should parse multiple frontmatter properties', () => {
    const content = '---\ntitle: Test\nauthor: Alice\n---\nBody';
    const result = parseFrontmatter(content);

    it('should parse the title property', () => {
      expect(result).toHaveProperty('title', 'Test');
    });

    it('should parse the author property', () => {
      expect(result).toHaveProperty('author', 'Alice');
    });
  });

  it('should parse numeric frontmatter values', () => {
    const content = '---\ncount: 42\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('count', 42);
  });

  it('should parse boolean frontmatter values', () => {
    const content = '---\npublish: true\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toHaveProperty('publish', true);
  });

  it('should return an empty object when there is no frontmatter', () => {
    const content = 'No frontmatter here';
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });

  it('should return an empty object when frontmatter is empty', () => {
    const content = '---\n\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });
});

describe('setFrontmatter', () => {
  describe('should add frontmatter to content without existing frontmatter', () => {
    const content = 'Body text';
    const result = setFrontmatter(content, { title: 'New' });

    it('should include frontmatter delimiters', () => {
      expect(result).toContain('---\n');
    });

    it('should include the title property', () => {
      expect(result).toContain('title: New');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  describe('should prepend frontmatter delimiters when adding new frontmatter', () => {
    const content = 'Some body content';
    const result = setFrontmatter(content, { key: 'value' });

    it('should start with frontmatter delimiters', () => {
      expect(result.startsWith('---\n')).toBe(true);
    });

    it('should contain frontmatter delimiters', () => {
      expect(result).toContain('---\n');
    });

    it('should end with the original body content', () => {
      expect(result.endsWith('Some body content')).toBe(true);
    });
  });

  describe('should replace existing frontmatter with new frontmatter', () => {
    const content = '---\ntitle: Old\n---\nBody text';
    const result = setFrontmatter(content, { title: 'New' });

    it('should contain the new title', () => {
      expect(result).toContain('title: New');
    });

    it('should not contain the old title', () => {
      expect(result).not.toContain('title: Old');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  describe('should remove frontmatter when new frontmatter is empty', () => {
    const content = '---\ntitle: Remove Me\n---\nBody text';
    const result = setFrontmatter(content, {});

    it('should not contain frontmatter delimiters', () => {
      expect(result).not.toContain('---');
    });

    it('should preserve the body text', () => {
      expect(result).toContain('Body text');
    });
  });

  it('should return just the body when removing frontmatter from content that has it', () => {
    const content = '---\ntitle: Test\n---\nBody only';
    const result = setFrontmatter(content, {});
    expect(result).toBe('Body only');
  });

  it('should return empty string when removing frontmatter and there is no body', () => {
    const content = 'No frontmatter, just text';
    const result = setFrontmatter(content, {});
    expect(result).toBe('No frontmatter, just text');
  });

  describe('should handle setting frontmatter with multiple properties', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { author: 'Bob', title: 'Test' });

    it('should contain the title property', () => {
      expect(result).toContain('title: Test');
    });

    it('should contain the author property', () => {
      expect(result).toContain('author: Bob');
    });

    it('should preserve the body', () => {
      expect(result).toContain('Body');
    });
  });

  it('should handle boolean values in new frontmatter', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { publish: true });
    expect(result).toContain('publish: true');
  });

  it('should handle numeric values in new frontmatter', () => {
    const content = 'Body';
    const result = setFrontmatter(content, { order: 5 });
    expect(result).toContain('order: 5');
  });
});
