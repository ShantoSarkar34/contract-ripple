import { unzipSync } from "fflate";
import {
  SOURCE_ANALYSIS_LIMITS,
  hasIgnoredDirectory,
  isSupportedSourcePath,
  type SourceFileInput,
} from "@contract-ripple/source-analysis";

/** Maximum compressed ZIP upload size accepted by the API. */
export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;

/** Maximum number of ZIP entries (including directories) accepted. */
export const MAX_ARCHIVE_ENTRIES = 5_000;

export type ZipErrorCode =
  | "invalid_zip"
  | "unsafe_path"
  | "too_many_entries"
  | "too_many_files"
  | "archive_too_large";

export class ZipError extends Error {
  constructor(
    readonly code: ZipErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ZipError";
  }
}

export type SkippedZipFile = {
  path: string;
  reason: "unsupported_file_type" | "ignored_directory" | "file_too_large" | "non_utf8_text";
};

export type ZipExtractionResult = {
  files: SourceFileInput[];
  skipped: SkippedZipFile[];
  totalBytes: number;
  entryCount: number;
};

const decoder = new TextDecoder("utf-8", { fatal: true });

function hasZipMagic(data: Uint8Array): boolean {
  if (data.length < 4) {
    return false;
  }
  const signature = [data[0], data[1], data[2], data[3]];
  return (
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    (signature[2] === 0x03 || signature[2] === 0x05 || signature[2] === 0x07) &&
    (signature[3] === 0x04 || signature[3] === 0x06 || signature[3] === 0x08)
  );
}

function stripLeadingDotSlash(path: string): string {
  let value = path;
  while (value.startsWith("./")) {
    value = value.slice(2);
  }
  return value;
}

function assertSafeEntryName(rawName: string): string {
  const name = stripLeadingDotSlash(rawName.replace(/\\/g, "/"));
  if (name.length === 0 || name.includes("\0")) {
    throw new ZipError("unsafe_path", "The archive contains an entry with an invalid name.");
  }
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
    throw new ZipError("unsafe_path", "The archive contains an absolute path.");
  }
  const segments = name.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "..")) {
    throw new ZipError("unsafe_path", "The archive contains a path traversal entry.");
  }
  return name;
}

/**
 * Extracts supported source files from an untrusted ZIP archive.
 *
 * Safety properties:
 * - the archive is never written to disk,
 * - entry names are checked for traversal/absolute paths,
 * - entry count, per-file size, and total uncompressed size are bounded,
 * - only UTF-8 TypeScript/JavaScript files are returned.
 */
export function extractSourceFromZip(data: Uint8Array): ZipExtractionResult {
  if (!hasZipMagic(data)) {
    throw new ZipError("invalid_zip", "The uploaded file is not a valid ZIP archive.");
  }

  const files: SourceFileInput[] = [];
  const skipped: SkippedZipFile[] = [];
  let entryCount = 0;
  let sourceCount = 0;
  let totalBytes = 0;

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(data, {
      filter: (file) => {
        entryCount += 1;
        if (entryCount > MAX_ARCHIVE_ENTRIES) {
          throw new ZipError(
            "too_many_entries",
            `The archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`,
          );
        }

        if (file.name.endsWith("/")) {
          assertSafeEntryName(file.name.slice(0, -1));
          return false;
        }

        const name = assertSafeEntryName(file.name);
        if (hasIgnoredDirectory(name)) {
          skipped.push({ path: name, reason: "ignored_directory" });
          return false;
        }
        if (!isSupportedSourcePath(name)) {
          skipped.push({ path: name, reason: "unsupported_file_type" });
          return false;
        }
        if (file.compression !== 0 && file.compression !== 8) {
          skipped.push({ path: name, reason: "unsupported_file_type" });
          return false;
        }
        if (file.originalSize > SOURCE_ANALYSIS_LIMITS.maxFileBytes) {
          skipped.push({ path: name, reason: "file_too_large" });
          return false;
        }
        if (totalBytes + file.originalSize > SOURCE_ANALYSIS_LIMITS.maxTotalBytes) {
          throw new ZipError(
            "archive_too_large",
            `The archive expands beyond ${SOURCE_ANALYSIS_LIMITS.maxTotalBytes} bytes.`,
          );
        }
        if (sourceCount >= SOURCE_ANALYSIS_LIMITS.maxFiles) {
          throw new ZipError(
            "too_many_files",
            `The archive contains more than ${SOURCE_ANALYSIS_LIMITS.maxFiles} source files.`,
          );
        }

        sourceCount += 1;
        totalBytes += file.originalSize;
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ZipError) {
      throw error;
    }
    throw new ZipError("invalid_zip", "The ZIP archive could not be read.");
  }

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (bytes.byteLength > SOURCE_ANALYSIS_LIMITS.maxFileBytes) {
      skipped.push({ path, reason: "file_too_large" });
      continue;
    }
    let content: string;
    try {
      content = decoder.decode(bytes);
    } catch {
      skipped.push({ path, reason: "non_utf8_text" });
      continue;
    }
    files.push({ path, content });
  }

  return {
    files,
    skipped,
    totalBytes,
    entryCount,
  };
}
