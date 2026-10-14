import { ENV } from "@/wab/client/env";
import { previewFormat } from "@/wab/client/components/dashboard/preview/types";

const maxBytes = 16 * 1024 * 1024;
const maxEntries = 64;
interface Metadata {
  key: string;
  revision: number;
  build?: string;
  format: string;
  size: number;
  usedAt: number;
}

async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("plasmic-canvas-previews", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("images");
      request.result.createObjectStore("metadata", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function completed(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function readPreview(key: string) {
  const db = await open();
  try {
    const tx = db.transaction(["images", "metadata"], "readwrite");
    const done = completed(tx);
    let bytes: ArrayBuffer | undefined;
    let meta: Metadata | undefined;
    const request = tx.objectStore("metadata").getAll();
    request.onsuccess = () => {
      // Include images written with the former build-specific key on upgrade.
      const entries = request.result as Metadata[];
      meta = entries.find((entry) => entry.key === key) ?? entries
        .filter((entry) => entry.key.startsWith(`${key}:`))
        .sort((a, b) => b.usedAt - a.usedAt)[0];
      if (meta) {
        const image = tx.objectStore("images").get(meta.key);
        image.onsuccess = () => {
          bytes = image.result;
        };
        tx.objectStore("metadata").put({ ...meta, usedAt: Date.now() });
      }
    };
    await done;
    return bytes && meta
      ? { blob: new Blob([bytes], { type: "image/png" }), revision: meta.revision, build: meta.build, format: meta.format }
      : undefined;
  } finally {
    db.close();
  }
}

export async function writePreview(key: string, revision: number, blob: Blob) {
  if (blob.size > maxBytes) {
    return;
  }
  // ArrayBuffer is supported by WebKit IndexedDB where Blob writes may fail.
  const bytes = await blob.arrayBuffer();
  const db = await open();
  try {
    const tx = db.transaction(["images", "metadata"], "readwrite");
    const done = completed(tx);
    const metadata = tx.objectStore("metadata"),
      images = tx.objectStore("images");
    metadata.put({
      key,
      revision,
      build: ENV.COMMITHASH,
      format: previewFormat,
      size: bytes.byteLength,
      usedAt: Date.now(),
    } satisfies Metadata);
    images.put(bytes, key);
    const request = metadata.getAll();
    request.onsuccess = () => {
      const entries = (request.result as Metadata[])
        .filter((item) => {
          if (item.key.startsWith(`${key}:`)) {
            metadata.delete(item.key);
            images.delete(item.key);
            return false;
          }
          return true;
        })
        .sort((a, b) => a.usedAt - b.usedAt);
      let size = entries.reduce((total, item) => total + item.size, 0),
        count = entries.length;
      for (const item of entries) {
        if (size <= maxBytes && count <= maxEntries) {
          break;
        }
        metadata.delete(item.key);
        images.delete(item.key);
        size -= item.size;
        count--;
      }
    };
    await done;
  } finally {
    db.close();
  }
}
