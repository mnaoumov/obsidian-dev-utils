import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { castTo } from '../../src/object-utils.ts';
import { readdirPosix } from '../../src/script-utils/fs.ts';

const { mockReaddir } = vi.hoisted(() => ({
  mockReaddir: vi.fn()
}));

vi.mock('../../src/script-utils/node-modules.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/script-utils/node-modules.ts')>();
  return {
    ...mod,
    readdir: mockReaddir
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('readdirPosix', () => {
  describe('string result (default options)', () => {
    it('should convert paths to POSIX format', async () => {
      mockReaddir.mockResolvedValue(['src\\utils\\file.ts', 'src\\index.ts']);
      const result = await readdirPosix('/some/dir');
      expect(result).toEqual(['src/utils/file.ts', 'src/index.ts']);
    });

    it('should handle already-POSIX paths', async () => {
      mockReaddir.mockResolvedValue(['src/file.ts']);
      const result = await readdirPosix('/some/dir');
      expect(result).toEqual(['src/file.ts']);
    });

    it('should handle empty directory', async () => {
      mockReaddir.mockResolvedValue([]);
      const result = await readdirPosix('/empty');
      expect(result).toEqual([]);
    });

    it('should pass default empty object options when no options provided', async () => {
      mockReaddir.mockResolvedValue(['a.ts']);
      await readdirPosix('/dir');
      expect(mockReaddir).toHaveBeenCalledWith('/dir', {});
    });

    it('should accept explicit string encoding options', async () => {
      mockReaddir.mockResolvedValue(['file.ts']);
      const result = await readdirPosix('/dir', { encoding: 'utf-8' });
      expect(result).toEqual(['file.ts']);
    });
  });

  describe('buffer result', () => {
    it('should convert buffers to POSIX format with "buffer" string option', async () => {
      mockReaddir.mockResolvedValue([Buffer.from('src\\file.ts')]);
      const result = await readdirPosix('/dir', 'buffer');
      expect(result).toHaveLength(1);
      expect(Buffer.isBuffer(result[0])).toBe(true);
    });

    it('should convert buffers to POSIX format with encoding: "buffer" option', async () => {
      mockReaddir.mockResolvedValue([Buffer.from('src\\file.ts')]);
      const result = await readdirPosix('/dir', { encoding: 'buffer' });
      expect(result).toHaveLength(1);
      expect(Buffer.isBuffer(result[0])).toBe(true);
    });
  });

  describe('dirent result', () => {
    it('should convert dirent name and parentPath to POSIX format', async () => {
      const mockDirents = [
        { name: 'sub\\file.ts', parentPath: 'C:\\project\\src' },
        { name: 'index.ts', parentPath: 'C:\\project' }
      ];
      mockReaddir.mockResolvedValue(mockDirents);
      const result = castTo<{ name: string; parentPath: string }[]>(await readdirPosix('/dir', { withFileTypes: true }));
      expect(result[0]?.name).toBe('sub/file.ts');
      expect(result[0]?.parentPath).toBe('C:/project/src');
      expect(result[1]?.name).toBe('index.ts');
      expect(result[1]?.parentPath).toBe('C:/project');
    });

    it('should handle empty directory with dirent options', async () => {
      mockReaddir.mockResolvedValue([]);
      const result = await readdirPosix('/empty', { withFileTypes: true });
      expect(result).toEqual([]);
    });
  });
});
