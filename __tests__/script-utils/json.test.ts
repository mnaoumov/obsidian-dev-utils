import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  editJson,
  editJsonSync,
  readJson,
  readJsonSync,
  writeJson,
  writeJsonSync
} from '../../src/script-utils/json.ts';
import { assertNonNullable } from '../../src/type-guards.ts';

interface CountJson {
  count: number;
}

interface ItemsJson {
  items: string[];
}

interface KeyJson {
  key: string;
}

interface NameJson {
  name: string;
}

interface ValJson {
  val: number;
}

const {
  mockExistsSync,
  mockReadFile,
  mockReadFileSync,
  mockWriteFile,
  mockWriteFileSync
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockReadFile: vi.fn<(path: string, encoding: string) => Promise<string>>(),
  mockReadFileSync: vi.fn<(path: string, encoding: string) => string>(),
  mockWriteFile: vi.fn<(path: string, data: string) => Promise<void>>(),
  mockWriteFileSync: vi.fn<(path: string, data: string) => void>()
}));

vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>();
  return {
    ...mod,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...mod,
    readFile: mockReadFile,
    writeFile: mockWriteFile
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mockWriteFile.mockResolvedValue(undefined);
});

describe('readJson', () => {
  it('should read and parse JSON file', async () => {
    mockReadFile.mockResolvedValue('{"name":"test"}');
    const result = await readJson<NameJson>('/file.json');
    expect(result).toEqual({ name: 'test' });
    expect(mockReadFile).toHaveBeenCalledWith('/file.json', 'utf-8');
  });

  it('should handle array JSON', async () => {
    mockReadFile.mockResolvedValue('[1,2,3]');
    const result = await readJson<number[]>('/arr.json');
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('readJsonSync', () => {
  it('should read and parse JSON file synchronously', () => {
    mockReadFileSync.mockReturnValue('{"key":"value"}');
    const result = readJsonSync<KeyJson>('/file.json');
    expect(result).toEqual({ key: 'value' });
    expect(mockReadFileSync).toHaveBeenCalledWith('/file.json', 'utf-8');
  });
});

describe('writeJson', () => {
  it('should write JSON with trailing newline', async () => {
    await writeJson('/out.json', { a: 1 });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = mockWriteFile.mock.calls[0]?.[1];
    assertNonNullable(written);
    expect(written).toMatch(/\n$/);
    expect(JSON.parse(written)).toEqual({ a: 1 });
  });
});

describe('writeJsonSync', () => {
  it('should write JSON synchronously with trailing newline', () => {
    writeJsonSync('/out.json', { b: 2 });
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const written = mockWriteFileSync.mock.calls[0]?.[1];
    assertNonNullable(written);
    expect(written).toMatch(/\n$/);
    expect(JSON.parse(written)).toEqual({ b: 2 });
  });
});

describe('editJson', () => {
  it('should read, edit, and write back JSON', async () => {
    mockReadFile.mockResolvedValue('{"count":0}');
    await editJson<CountJson>('/file.json', (data) => {
      data.count = 5;
    });
    expect(mockReadFile).toHaveBeenCalledWith('/file.json', 'utf-8');
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = mockWriteFile.mock.calls[0]?.[1];
    assertNonNullable(written);
    expect(JSON.parse(written)).toEqual({ count: 5 });
  });

  it('should skip if shouldSkipIfMissing is true and file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    await editJson('/missing.json', vi.fn(), { shouldSkipIfMissing: true });
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should not skip if shouldSkipIfMissing is true and file exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('{}');
    await editJson('/exists.json', vi.fn(), { shouldSkipIfMissing: true });
    expect(mockReadFile).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('should not check existence when shouldSkipIfMissing is not set', async () => {
    mockReadFile.mockResolvedValue('{}');
    await editJson('/file.json', vi.fn());
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('should support async edit functions', async () => {
    mockReadFile.mockResolvedValue('{"items":[]}');
    await editJson<ItemsJson>('/file.json', async (data) => {
      await Promise.resolve();
      data.items.push('new');
    });
    const written = mockWriteFile.mock.calls[0]?.[1];
    assertNonNullable(written);
    expect(JSON.parse(written)).toEqual({ items: ['new'] });
  });
});

describe('editJsonSync', () => {
  it('should read, edit, and write back JSON synchronously', () => {
    mockReadFileSync.mockReturnValue('{"val":1}');
    editJsonSync<ValJson>('/file.json', (data) => {
      data.val = 99;
    });
    expect(mockReadFileSync).toHaveBeenCalledWith('/file.json', 'utf-8');
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const written = mockWriteFileSync.mock.calls[0]?.[1];
    assertNonNullable(written);
    expect(JSON.parse(written)).toEqual({ val: 99 });
  });

  it('should skip if shouldSkipIfMissing is true and file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    editJsonSync('/missing.json', vi.fn(), { shouldSkipIfMissing: true });
    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should not skip if shouldSkipIfMissing is true and file exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');
    editJsonSync('/exists.json', vi.fn(), { shouldSkipIfMissing: true });
    expect(mockReadFileSync).toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
