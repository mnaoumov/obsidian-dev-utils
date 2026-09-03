/**
 * @file
 *
 * Extracts a ZIP archive to disk using only Node's `zlib` — with no third-party unzip dependency.
 *
 * It exists for one measured reason. The dependency it replaced on this path, `adm-zip`, bundled
 * roughly 34 KB of minified JavaScript into EVERY Obsidian plugin built with this library: a plugin
 * ships a single CJS `main.js`, esbuild has no code splitting to put a dependency behind, and a
 * `await import()` only defers evaluation — the module body is inlined either way. `node:zlib` is
 * already an esbuild external, so the same work now costs a plugin bundle nothing at all. Archives
 * are still WRITTEN with `adm-zip` at release time (`script-utils/demo-vault.ts`), which is Node-side
 * tooling and never reaches a plugin bundle.
 *
 * Deliberately narrow: it reads exactly what that writer produces — stored and deflated entries in an
 * unencrypted archive below the 4 GB / 65535-entry ZIP64 threshold — and raises a named error for
 * anything else rather than guessing at it. Sizes and offsets are taken from the central directory,
 * which is authoritative even for archives written with data descriptors.
 *
 * The `node:` imports below are safe to merely EVALUATE on mobile — `require` hands back `undefined`
 * there and nothing reads it at load time — so this module can sit in the generated barrels without
 * breaking the library's load on Android. Only the calls are desktop-only.
 */

import type { Buffer } from 'node:buffer';

import { inflateRawSync } from 'node:zlib';

import {
  dirname,
  join
} from './path.ts';

/**
 * Parameters for {@link extractZipArchive}.
 */
export interface ExtractZipArchiveParams {
  /**
   * The raw ZIP archive bytes.
   */
  readonly archive: Buffer;

  /**
   * The file-system implementation the extracted entries are written with.
   *
   * Injected rather than imported so the caller chooses which `fs` writes the files. The demo-vault
   * opener hands over Electron's `original-fs` (see {@link ZipExtractionFileSystem}).
   */
  readonly fileSystem: ZipExtractionFileSystem;

  /**
   * The directory to extract into. Created if it does not exist.
   */
  readonly targetDirectory: string;
}

/**
 * The slice of `node:fs` extraction needs.
 *
 * Only the two WRITING calls are required, and that is deliberate: Electron's asar layer intercepts
 * `fs` READS (and `existsSync`) on any path containing `.asar`, which a demo vault may legitimately
 * ship as a plain file. Never probing the target with a read keeps that interception out of the
 * picture entirely, and a caller that hands over Electron's `original-fs` is safe even from the
 * write side.
 */
export interface ZipExtractionFileSystem {
  /**
   * Creates a directory, including any missing parents.
   *
   * @param path - The directory to create.
   * @param options - The {@link ZipExtractionMkdirOptions}.
   * @returns The first directory created, if any.
   */
  mkdirSync(path: string, options: ZipExtractionMkdirOptions): string | undefined;

  /**
   * Writes a file, overwriting it if it exists.
   *
   * @param path - The file to write.
   * @param data - The bytes to write.
   */
  writeFileSync(path: string, data: Buffer): void;
}

/**
 * The options {@link ZipExtractionFileSystem.mkdirSync} is always called with.
 *
 * Extraction never probes for an existing directory, so every call has to create the missing parents
 * itself and tolerate a directory that is already there.
 */
export interface ZipExtractionMkdirOptions {
  /**
   * Always `true`.
   */
  readonly recursive: true;
}

interface ZipEntry {
  readonly compressedSize: number;
  readonly compressionMethod: number;
  readonly localHeaderOffset: number;
  readonly name: string;
}

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06_05_4B_50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02_01_4B_50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04_03_4B_50;

const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_ARCHIVE_COMMENT_LENGTH = 65_535;

// A count or offset saturated to all-ones means the real value lives in a ZIP64 record this reader
// Does not implement, so the field must never be read at face value.
const SATURATED_UINT_16 = 65_535;
const SATURATED_UINT_32 = 4_294_967_295;

// Field offsets within the end-of-central-directory record.
const ARCHIVE_ENTRY_COUNT_OFFSET = 10;
const CENTRAL_DIRECTORY_START_OFFSET = 16;

// Field offsets within a central-directory header.
const CENTRAL_DIRECTORY_FLAGS_OFFSET = 8;
const CENTRAL_DIRECTORY_COMPRESSION_METHOD_OFFSET = 10;
const CENTRAL_DIRECTORY_COMPRESSED_SIZE_OFFSET = 20;
const CENTRAL_DIRECTORY_NAME_LENGTH_OFFSET = 28;
const CENTRAL_DIRECTORY_EXTRA_LENGTH_OFFSET = 30;
const CENTRAL_DIRECTORY_COMMENT_LENGTH_OFFSET = 32;
const CENTRAL_DIRECTORY_LOCAL_HEADER_OFFSET_OFFSET = 42;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;

// Field offsets within a local file header.
const LOCAL_HEADER_NAME_LENGTH_OFFSET = 26;
const LOCAL_HEADER_EXTRA_LENGTH_OFFSET = 28;
const LOCAL_HEADER_SIZE = 30;

const COMPRESSION_METHOD_STORED = 0;
const COMPRESSION_METHOD_DEFLATED = 8;

// Bit 0 of the general-purpose flags marks an encrypted entry, and it is the lowest bit — so the
// Remainder tests it without reaching for a bitwise operator.
const ENCRYPTED_FLAG_DIVISOR = 2;

const ENTRY_NAME_SEPARATOR = '/';
const WINDOWS_DRIVE_PREFIX_REG_EXP = /^[A-Za-z]:/;

/**
 * Extracts every entry of a ZIP archive into a directory.
 *
 * Directory entries become directories; a file entry's parents are created whether or not the archive
 * declared them. An entry whose name would escape {@link ExtractZipArchiveParams.targetDirectory} is
 * refused rather than written (the "zip slip" traversal), as is an encrypted, ZIP64, or
 * unknown-compression archive.
 *
 * @param params - The {@link ExtractZipArchiveParams}.
 * @throws An {@link Error} naming the reason when the archive cannot be read as written.
 */
export function extractZipArchive(params: ExtractZipArchiveParams): void {
  const {
    archive,
    fileSystem,
    targetDirectory
  } = params;

  fileSystem.mkdirSync(targetDirectory, { recursive: true });

  for (const entry of readCentralDirectory(archive)) {
    assertSafeEntryName(entry.name);

    if (entry.name.endsWith(ENTRY_NAME_SEPARATOR)) {
      // Named without its trailing separator, so the created path reads the same as every other one.
      fileSystem.mkdirSync(join(targetDirectory, entry.name.slice(0, -1)), { recursive: true });
      continue;
    }

    const entryPath = join(targetDirectory, entry.name);
    fileSystem.mkdirSync(dirname(entryPath), { recursive: true });
    fileSystem.writeFileSync(entryPath, readEntryData(archive, entry));
  }
}

/**
 * Refuses an entry name that would place the extracted file outside the target directory.
 *
 * An archive is untrusted input even when we published it ourselves, and every one of these shapes
 * escapes the target: an absolute POSIX path, a Windows drive-qualified path, a backslash (which the
 * ZIP specification forbids as a separator, so its only use here is to smuggle one past a
 * forward-slash check), and a `..` segment.
 *
 * @param entryName - The entry name as recorded in the archive.
 */
function assertSafeEntryName(entryName: string): void {
  if (entryName.startsWith(ENTRY_NAME_SEPARATOR)) {
    throw new Error(`Refusing to extract the absolute archive entry '${entryName}'.`);
  }

  if (WINDOWS_DRIVE_PREFIX_REG_EXP.test(entryName)) {
    throw new Error(`Refusing to extract the drive-qualified archive entry '${entryName}'.`);
  }

  if (entryName.includes('\\')) {
    throw new Error(`Refusing to extract the archive entry '${entryName}', which uses a backslash separator.`);
  }

  if (entryName.split(ENTRY_NAME_SEPARATOR).includes('..')) {
    throw new Error(`Refusing to extract the archive entry '${entryName}', which points outside the target directory.`);
  }
}

/**
 * Locates the end-of-central-directory record and returns its offset.
 *
 * The record sits at the very end of the archive unless a trailing comment follows it, so it is found
 * by scanning backwards over the comment's maximum length rather than assumed to be at a fixed place.
 *
 * @param archive - The raw ZIP archive bytes.
 * @returns The record's offset.
 */
function findEndOfCentralDirectoryOffset(archive: Buffer): number {
  const lastPossibleOffset = archive.length - END_OF_CENTRAL_DIRECTORY_SIZE;
  const firstPossibleOffset = Math.max(0, lastPossibleOffset - MAX_ARCHIVE_COMMENT_LENGTH);

  for (let offset = lastPossibleOffset; offset >= firstPossibleOffset; offset--) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('The archive is not a ZIP file: its end-of-central-directory record is missing.');
}

/**
 * Reads the central directory, which is the archive's authoritative index of its entries.
 *
 * @param archive - The raw ZIP archive bytes.
 * @returns One {@link ZipEntry} per entry, in the order the archive lists them.
 */
function readCentralDirectory(archive: Buffer): ZipEntry[] {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(archive);
  const entryCount = archive.readUInt16LE(endOfCentralDirectoryOffset + ARCHIVE_ENTRY_COUNT_OFFSET);
  let entryOffset = archive.readUInt32LE(endOfCentralDirectoryOffset + CENTRAL_DIRECTORY_START_OFFSET);

  if (entryCount === SATURATED_UINT_16 || entryOffset === SATURATED_UINT_32) {
    throw new Error('ZIP64 archives are not supported.');
  }

  const entries: ZipEntry[] = [];
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
    if (archive.readUInt32LE(entryOffset) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      throw new Error(`The archive's central directory is corrupt at entry ${String(entryIndex)}.`);
    }

    const flags = archive.readUInt16LE(entryOffset + CENTRAL_DIRECTORY_FLAGS_OFFSET);
    if (flags % ENCRYPTED_FLAG_DIVISOR === 1) {
      throw new Error('Encrypted ZIP archives are not supported.');
    }

    const compressedSize = archive.readUInt32LE(entryOffset + CENTRAL_DIRECTORY_COMPRESSED_SIZE_OFFSET);
    const localHeaderOffset = archive.readUInt32LE(entryOffset + CENTRAL_DIRECTORY_LOCAL_HEADER_OFFSET_OFFSET);
    if (compressedSize === SATURATED_UINT_32 || localHeaderOffset === SATURATED_UINT_32) {
      throw new Error('ZIP64 archives are not supported.');
    }

    const nameLength = archive.readUInt16LE(entryOffset + CENTRAL_DIRECTORY_NAME_LENGTH_OFFSET);
    const nameOffset = entryOffset + CENTRAL_DIRECTORY_HEADER_SIZE;
    entries.push({
      compressedSize,
      compressionMethod: archive.readUInt16LE(entryOffset + CENTRAL_DIRECTORY_COMPRESSION_METHOD_OFFSET),
      localHeaderOffset,
      name: archive.toString('utf-8', nameOffset, nameOffset + nameLength)
    });

    entryOffset = nameOffset
      + nameLength
      + archive.readUInt16LE(entryOffset + CENTRAL_DIRECTORY_EXTRA_LENGTH_OFFSET)
      + archive.readUInt16LE(entryOffset + CENTRAL_DIRECTORY_COMMENT_LENGTH_OFFSET);
  }

  return entries;
}

/**
 * Reads and decompresses one entry's bytes.
 *
 * The data's start is computed from the LOCAL header rather than the central one: the two carry
 * independent name and extra-field lengths, and only the local pair describes where the bytes
 * actually begin.
 *
 * @param archive - The raw ZIP archive bytes.
 * @param entry - The entry, as read from the central directory.
 * @returns The entry's uncompressed content.
 */
function readEntryData(archive: Buffer, entry: ZipEntry): Buffer {
  if (archive.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`The archive entry '${entry.name}' has a corrupt local header.`);
  }

  const dataOffset = entry.localHeaderOffset
    + LOCAL_HEADER_SIZE
    + archive.readUInt16LE(entry.localHeaderOffset + LOCAL_HEADER_NAME_LENGTH_OFFSET)
    + archive.readUInt16LE(entry.localHeaderOffset + LOCAL_HEADER_EXTRA_LENGTH_OFFSET);
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > archive.length) {
    throw new Error(`The archive is truncated: entry '${entry.name}' runs past its end.`);
  }

  const compressedData = archive.subarray(dataOffset, dataEnd);
  switch (entry.compressionMethod) {
    case COMPRESSION_METHOD_DEFLATED: {
      return inflateRawSync(compressedData);
    }
    case COMPRESSION_METHOD_STORED: {
      return compressedData;
    }
    default: {
      throw new Error(`The archive entry '${entry.name}' uses unsupported compression method ${String(entry.compressionMethod)}.`);
    }
  }
}
