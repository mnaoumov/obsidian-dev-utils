import type { Zippable } from 'fflate';

import { zipSync } from 'fflate';
import { Buffer } from 'node:buffer';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { ZipExtractionFileSystem } from './desktop-zip-extractor.ts';

import { extractZipArchive } from './desktop-zip-extractor.ts';

interface ArchiveEntryDefinition {
  readonly content: string;
  readonly name: string;
  readonly shouldStore?: boolean;
}

interface FileSystemRecorder {
  readonly createdDirectories: string[];
  readonly fileSystem: ZipExtractionFileSystem;
  readonly writtenFiles: Map<string, string>;
}

const TARGET_DIRECTORY = '/vaults/target';

const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ARCHIVE_ENTRY_COUNT_OFFSET = 10;
const CENTRAL_DIRECTORY_START_OFFSET = 16;
const CENTRAL_DIRECTORY_FLAGS_OFFSET = 8;
const CENTRAL_DIRECTORY_COMPRESSION_METHOD_OFFSET = 10;
const CENTRAL_DIRECTORY_COMPRESSED_SIZE_OFFSET = 20;
const CENTRAL_DIRECTORY_LOCAL_HEADER_OFFSET_OFFSET = 42;

// `fflate`'s per-entry compression level, where `0` is the one that stores rather than deflates.
const STORED_COMPRESSION_LEVEL = 0;
const UNSUPPORTED_COMPRESSION_METHOD = 99;
const SATURATED_UINT_16 = 65_535;
const SATURATED_UINT_32 = 4_294_967_295;
const ENCRYPTED_FLAG = 1;
const IMPOSSIBLE_COMPRESSED_SIZE = 1_000_000;
const NON_ARCHIVE_BYTE_COUNT = 64;

describe('extractZipArchive', () => {
  it('should extract a deflated entry, creating the target and the entry\'s parents', () => {
    const recorder = extract(buildArchive([{ content: 'The note body, long enough to be worth deflating.', name: 'notes/deep/note.md' }]));

    expect(recorder.writtenFiles.get(`${TARGET_DIRECTORY}/notes/deep/note.md`)).toBe('The note body, long enough to be worth deflating.');
    expect(recorder.createdDirectories).toEqual([TARGET_DIRECTORY, `${TARGET_DIRECTORY}/notes/deep`]);
  });

  it('should extract a stored entry verbatim', () => {
    // A stored entry's bytes are already the content — reading it as deflated would fail, and returning
    // its bytes without checking the method would corrupt every deflated one.
    const recorder = extract(buildArchive([{ content: 'Stored, not deflated.', name: 'stored.md', shouldStore: true }]));

    expect(recorder.writtenFiles.get(`${TARGET_DIRECTORY}/stored.md`)).toBe('Stored, not deflated.');
  });

  it('should extract an empty entry', () => {
    const recorder = extract(buildArchive([{ content: '', name: 'empty.md' }]));

    expect(recorder.writtenFiles.get(`${TARGET_DIRECTORY}/empty.md`)).toBe('');
  });

  it('should create a directory for an entry that names one', () => {
    const recorder = extract(buildArchive([{ content: '', name: 'Materials/' }]));

    expect(recorder.createdDirectories).toEqual([TARGET_DIRECTORY, `${TARGET_DIRECTORY}/Materials`]);
    expect(recorder.writtenFiles.size).toBe(0);
  });

  it('should extract a file that only looks like an Electron archive', () => {
    // A demo vault may ship `_assets/CodeScriptToolkit/module.asar` to demonstrate the ASAR require
    // feature. It is a plain file here, and extracting it must not be treated as writing into an archive.
    const recorder = extract(buildArchive([{ content: 'not really an archive', name: '_assets/CodeScriptToolkit/module.asar' }]));

    expect(recorder.writtenFiles.get(`${TARGET_DIRECTORY}/_assets/CodeScriptToolkit/module.asar`)).toBe('not really an archive');
  });

  it('should extract every entry of a multi-entry archive', () => {
    const recorder = extract(buildArchive([
      { content: 'first', name: 'a.md' },
      { content: '', name: 'sub/' },
      { content: 'second', name: 'sub/b.md' }
    ]));

    expect([...recorder.writtenFiles.keys()]).toEqual([`${TARGET_DIRECTORY}/a.md`, `${TARGET_DIRECTORY}/sub/b.md`]);
  });

  it('should refuse a file that is not a ZIP archive', () => {
    expect(() => extract(Buffer.alloc(NON_ARCHIVE_BYTE_COUNT))).toThrow('end-of-central-directory record is missing');
  });

  it('should refuse an archive whose entry count is ZIP64-saturated', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const endOfCentralDirectoryOffset = archive.length - END_OF_CENTRAL_DIRECTORY_SIZE;

    expect(() => extract(patchUInt16(archive, endOfCentralDirectoryOffset + ARCHIVE_ENTRY_COUNT_OFFSET, SATURATED_UINT_16)))
      .toThrow('ZIP64 archives are not supported.');
  });

  it('should refuse an archive whose central-directory offset is ZIP64-saturated', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const endOfCentralDirectoryOffset = archive.length - END_OF_CENTRAL_DIRECTORY_SIZE;

    expect(() => extract(patchUInt32(archive, endOfCentralDirectoryOffset + CENTRAL_DIRECTORY_START_OFFSET, SATURATED_UINT_32)))
      .toThrow('ZIP64 archives are not supported.');
  });

  it('should refuse an entry whose compressed size is ZIP64-saturated', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const entryOffset = getCentralDirectoryOffset(archive);

    expect(() => extract(patchUInt32(archive, entryOffset + CENTRAL_DIRECTORY_COMPRESSED_SIZE_OFFSET, SATURATED_UINT_32)))
      .toThrow('ZIP64 archives are not supported.');
  });

  it('should refuse an entry whose local-header offset is ZIP64-saturated', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const entryOffset = getCentralDirectoryOffset(archive);

    expect(() => extract(patchUInt32(archive, entryOffset + CENTRAL_DIRECTORY_LOCAL_HEADER_OFFSET_OFFSET, SATURATED_UINT_32)))
      .toThrow('ZIP64 archives are not supported.');
  });

  it('should refuse an archive with a corrupt central directory', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);

    expect(() => extract(patchUInt32(archive, getCentralDirectoryOffset(archive), 0))).toThrow('central directory is corrupt at entry 0');
  });

  it('should refuse an encrypted entry', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const flagsOffset = getCentralDirectoryOffset(archive) + CENTRAL_DIRECTORY_FLAGS_OFFSET;

    expect(() => extract(patchUInt16(archive, flagsOffset, archive.readUInt16LE(flagsOffset) + ENCRYPTED_FLAG)))
      .toThrow('Encrypted ZIP archives are not supported.');
  });

  it('should refuse an entry with a corrupt local header', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);

    expect(() => extract(patchUInt32(archive, getLocalHeaderOffset(archive), 0))).toThrow('entry \'note.md\' has a corrupt local header');
  });

  it('should refuse an entry that runs past the end of a truncated archive', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const entryOffset = getCentralDirectoryOffset(archive);

    expect(() => extract(patchUInt32(archive, entryOffset + CENTRAL_DIRECTORY_COMPRESSED_SIZE_OFFSET, IMPOSSIBLE_COMPRESSED_SIZE)))
      .toThrow('entry \'note.md\' runs past its end');
  });

  it('should refuse an entry compressed with an unsupported method', () => {
    const archive = buildArchive([{ content: 'body', name: 'note.md' }]);
    const entryOffset = getCentralDirectoryOffset(archive);

    expect(() => extract(patchUInt16(archive, entryOffset + CENTRAL_DIRECTORY_COMPRESSION_METHOD_OFFSET, UNSUPPORTED_COMPRESSION_METHOD)))
      .toThrow('entry \'note.md\' uses unsupported compression method 99');
  });

  // Each hostile name below is written into the archive verbatim, which is what a real attack ships: the
  // names are legal ZIP entry names, and only the reader stands between them and a file outside the target.
  it('should refuse an absolute entry name', () => {
    expect(() => extract(buildArchive([{ content: 'body', name: '/note.md' }])))
      .toThrow('Refusing to extract the absolute archive entry \'/note.md\'.');
  });

  it('should refuse a drive-qualified entry name', () => {
    expect(() => extract(buildArchive([{ content: 'body', name: 'C:note.md' }])))
      .toThrow('Refusing to extract the drive-qualified archive entry \'C:note.md\'.');
  });

  it('should refuse an entry name that uses a backslash separator', () => {
    expect(() => extract(buildArchive([{ content: 'body', name: String.raw`aaa\x.md` }])))
      .toThrow('which uses a backslash separator');
  });

  it('should refuse an entry name that climbs out of the target directory', () => {
    expect(() => extract(buildArchive([{ content: 'body', name: '../x.md' }])))
      .toThrow('which points outside the target directory');
  });
});

/**
 * Builds a ZIP archive with the same writer the release path uses, so what is read back is what a demo
 * vault archive really contains rather than a test-shaped approximation.
 *
 * That writer is a THIRD-PARTY one, which is the point: the reader under test is our own, so an archive it
 * accepts has been agreed on by two independent implementations rather than round-tripped through a single
 * shared understanding of the format.
 *
 * `fflate` deflates every entry by default; `level: 0` is what asks for a STORED one that carries bytes.
 * Entry names are written verbatim, hostile ones included, so a traversal case needs no patching.
 *
 * @param entryDefinitions - The entries to write.
 * @returns The archive bytes.
 */
function buildArchive(entryDefinitions: readonly ArchiveEntryDefinition[]): Buffer {
  const entries: Zippable = {};
  for (const entryDefinition of entryDefinitions) {
    const content = Buffer.from(entryDefinition.content, 'utf-8');
    entries[entryDefinition.name] = entryDefinition.shouldStore ? [content, { level: STORED_COMPRESSION_LEVEL }] : content;
  }

  return Buffer.from(zipSync(entries));
}

/**
 * Records what an extraction writes, standing in for the caller's `fs`.
 *
 * @returns The {@link FileSystemRecorder}.
 */
function createFileSystemRecorder(): FileSystemRecorder {
  const createdDirectories: string[] = [];
  const writtenFiles = new Map<string, string>();

  return {
    createdDirectories,
    fileSystem: {
      mkdirSync(path: string): undefined {
        createdDirectories.push(path);
      },
      writeFileSync(path: string, data: Buffer): void {
        writtenFiles.set(path, data.toString('utf-8'));
      }
    },
    writtenFiles
  };
}

/**
 * Extracts an archive into a recording file system.
 *
 * @param archive - The archive bytes.
 * @returns The {@link FileSystemRecorder} holding what was written.
 */
function extract(archive: Buffer): FileSystemRecorder {
  const recorder = createFileSystemRecorder();
  extractZipArchive({
    archive,
    fileSystem: recorder.fileSystem,
    targetDirectory: TARGET_DIRECTORY
  });
  return recorder;
}

/**
 * Reads the offset of the first central-directory header.
 *
 * @param archive - The archive bytes.
 * @returns The offset.
 */
function getCentralDirectoryOffset(archive: Buffer): number {
  return archive.readUInt32LE(archive.length - END_OF_CENTRAL_DIRECTORY_SIZE + CENTRAL_DIRECTORY_START_OFFSET);
}

/**
 * Reads the offset of the first entry's local file header.
 *
 * @param archive - The archive bytes.
 * @returns The offset.
 */
function getLocalHeaderOffset(archive: Buffer): number {
  return archive.readUInt32LE(getCentralDirectoryOffset(archive) + CENTRAL_DIRECTORY_LOCAL_HEADER_OFFSET_OFFSET);
}

/**
 * Rewrites a 16-bit field, leaving the rest of the archive untouched.
 *
 * @param archive - The archive bytes.
 * @param offset - The field's offset.
 * @param value - The value to write.
 * @returns The patched archive.
 */
function patchUInt16(archive: Buffer, offset: number, value: number): Buffer {
  const patched = Buffer.from(archive);
  patched.writeUInt16LE(value, offset);
  return patched;
}

/**
 * Rewrites a 32-bit field, leaving the rest of the archive untouched.
 *
 * @param archive - The archive bytes.
 * @param offset - The field's offset.
 * @param value - The value to write.
 * @returns The patched archive.
 */
function patchUInt32(archive: Buffer, offset: number, value: number): Buffer {
  const patched = Buffer.from(archive);
  patched.writeUInt32LE(value, offset);
  return patched;
}
