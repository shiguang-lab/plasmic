import type { PenFileEntry } from "@/wab/client/pen-importer/types";
import { assert, ensure } from "@/wab/shared/common";
import { unzipSync } from "fflate";

const MAX_BYTES = 100 * 1024 * 1024;
export function penPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") {continue;}
    if (part === "..") {
      assert(parts.length > 0, "Pen resource escapes the selected folder");
      parts.pop();
    } else {parts.push(part);}
  }
  return parts.join("/");
}

export class PenFiles {
  readonly files = new Map<string, Uint8Array | File>();
  private loadedBytes = 0;
  constructor(entries: PenFileEntry[]) {
    const add = (path: string, value: Uint8Array | File) => {
      path = penPath(path);
      if (/(^|\/)(\.git|node_modules|__MACOSX)(\/|$)/.test(path) || /(^|\/)\.DS_Store$/.test(path)) {return;}
      if (value instanceof Uint8Array) {this.loadedBytes += value.length;}
      assert(
        this.loadedBytes <= MAX_BYTES && this.files.size < 5000,
        "Pen import exceeds 100 MiB or 5000 files",
      );
      assert(!this.files.has(path), `Duplicate Pen file: ${path}`);
      this.files.set(path, value);
    };
    for (const entry of entries) {
      if (entry.bytes && /\.zip$/i.test(entry.path)) {
        let expanded = 0;
        const zip = unzipSync(entry.bytes, {
          filter: (file) => {
            expanded += file.originalSize;
            assert(expanded <= MAX_BYTES, "Pen ZIP exceeds 100 MiB");
            return !file.name.endsWith("/");
          },
        });
        for (const [path, bytes] of Object.entries(zip)) {add(path, bytes);}
      } else {add(entry.path, ensure(entry.bytes ?? entry.file, "Missing Pen file content"));}
    }
  }
  async load(path: string): Promise<void> {
    const value = ensure(this.files.get(path), `Missing Pen file: ${path}`);
    if (value instanceof Uint8Array) {return;}
    assert(this.loadedBytes + value.size <= MAX_BYTES, "Pen import exceeds 100 MiB of referenced files");
    const bytes = new Uint8Array(await value.arrayBuffer());
    this.loadedBytes += bytes.length;
    assert(this.loadedBytes <= MAX_BYTES, "Pen import exceeds 100 MiB of referenced files");
    this.files.set(path, bytes);
  }
  private bytes(path: string): Uint8Array {
    const value = this.files.get(path);
    assert(value instanceof Uint8Array, `Pen resource is not loaded: ${path}`);
    return value;
  }
  resolve(from: string, uri: string): string {
    assert(!/^[a-z]+:/i.test(uri), `Unsupported external Pen resource: ${uri}`);
    // Generated scripts may contain absolute paths from their authoring machine.
    // Match only explicitly selected files, preserving their directory suffix.
    if (/^(\/|[A-Za-z]:[\\/])/.test(uri)) {
      const normalized = uri.replace(/\\/g, "/");
      const matches = [...this.files.keys()].filter((file) =>
        normalized.endsWith(`/${file}`),
      );
      assert(
        matches.length === 1,
        `Missing or ambiguous Pen resource: ${uri}. Select its containing folder or ZIP.`,
      );
      return matches[0];
    }
    const path = penPath(`${from.slice(0, from.lastIndexOf("/") + 1)}${uri}`);
    ensure(
      this.files.get(path),
      `Missing Pen resource: ${path}. Select its containing folder or ZIP.`,
    );
    return path;
  }
  text(path: string): string {
    return new TextDecoder().decode(
      this.bytes(path),
    );
  }
  data(path: string): string {
    const bytes = this.bytes(path);
    const ext = path.split(".").pop()?.toLowerCase();
    const mime = (
      {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        avif: "image/avif",
      } as Record<string, string>
    )[ext ?? ""];
    assert(mime, `Unsupported Pen image: ${path}`);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      {binary += String.fromCharCode(...bytes.subarray(i, i + 8192));}
    return `data:${mime};base64,${btoa(binary)}`;
  }
}
