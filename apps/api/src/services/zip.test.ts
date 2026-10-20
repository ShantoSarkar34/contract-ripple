import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ZipError, extractSourceFromZip } from "./zip.js";

function buildZip(entries: Record<string, Uint8Array>): Uint8Array {
  return zipSync(entries);
}

describe("extractSourceFromZip", () => {
  it("extracts supported source files and ignores unrelated entries", () => {
    const archive = buildZip({
      "src/api.ts": strToU8(`fetch("/pets");`),
      "src/component.tsx": strToU8(`export const x = 1;`),
      "README.md": strToU8("# docs"),
      "node_modules/pkg/index.ts": strToU8(`fetch("/pets");`),
      "dist/bundle.js": strToU8(`fetch("/pets");`),
    });

    const result = extractSourceFromZip(archive);

    expect(result.files.map((file) => file.path).sort()).toEqual([
      "src/api.ts",
      "src/component.tsx",
    ]);
    expect(result.files[0]?.content).toContain("fetch");
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { path: "README.md", reason: "unsupported_file_type" },
        { path: "node_modules/pkg/index.ts", reason: "ignored_directory" },
        { path: "dist/bundle.js", reason: "ignored_directory" },
      ]),
    );
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("returns an empty result for an empty archive", () => {
    const result = extractSourceFromZip(buildZip({}));

    expect(result.files).toHaveLength(0);
    expect(result.entryCount).toBe(0);
  });

  it("rejects data that is not a ZIP archive", () => {
    expect(() => extractSourceFromZip(strToU8("not a zip"))).toThrow(ZipError);
    expect(() => extractSourceFromZip(new Uint8Array())).toThrow(ZipError);
  });

  it("rejects path traversal entries", () => {
    expect(() => extractSourceFromZip(buildZip({ "../evil.ts": strToU8("x") }))).toThrow(
      expect.objectContaining({ code: "unsafe_path" }),
    );
    expect(() =>
      extractSourceFromZip(buildZip({ "..\\evil.ts": strToU8("x") })),
    ).toThrow(expect.objectContaining({ code: "unsafe_path" }));
  });

  it("rejects absolute paths", () => {
    expect(() =>
      extractSourceFromZip(buildZip({ "/etc/passwd.ts": strToU8("x") })),
    ).toThrow(expect.objectContaining({ code: "unsafe_path" }));
  });

  it("skips files over the per-file size limit", () => {
    const archive = buildZip({
      "src/big.ts": strToU8("a".repeat(1024 * 1024 + 1)),
      "src/small.ts": strToU8(`fetch("/pets");`),
    });

    const result = extractSourceFromZip(archive);

    expect(result.files.map((file) => file.path)).toEqual(["src/small.ts"]);
    expect(result.skipped).toContainEqual({ path: "src/big.ts", reason: "file_too_large" });
  });

  it("skips files that are not valid UTF-8", () => {
    const archive = buildZip({
      "src/binary.ts": new Uint8Array([0x66, 0x65, 0x74, 0x63, 0x68, 0xff, 0x29]),
    });

    const result = extractSourceFromZip(archive);

    expect(result.files).toHaveLength(0);
    expect(result.skipped).toContainEqual({ path: "src/binary.ts", reason: "non_utf8_text" });
  });
});
