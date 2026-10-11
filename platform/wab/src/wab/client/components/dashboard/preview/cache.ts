import { previewFormat } from "@/wab/client/components/dashboard/preview/types";

const maxBytes = 16 * 1024 * 1024;
const maxEntries = 64;
interface Metadata {
  key: string;
  revision: number;
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

export async function readPreview(key: string, revision: number) {
  const db = await open();
  try {
    const tx = db.transaction(["images", "metadata"], "readwrite");
    const done = completed(tx);
    let bytes: ArrayBuffer | undefined;
    const request = tx.objectStore("metadata").get(key);
    request.onsuccess = () => {
      const meta: Metadata | undefined = request.result;
      if (meta?.revision === revision && meta.format === previewFormat) {
        const image = tx.objectStore("images").get(key);
        image.onsuccess = () => {
          bytes = image.result;
        };
        tx.objectStore("metadata").put({ ...meta, usedAt: Date.now() });
      }
    };
    await done;
    return bytes ? new Blob([bytes], { type: "image/png" }) : undefined;
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
      format: previewFormat,
      size: bytes.byteLength,
      usedAt: Date.now(),
    } satisfies Metadata);
    images.put(bytes, key);
    const request = metadata.getAll();
    request.onsuccess = () => {
      const entries = (request.result as Metadata[]).sort(
        (a, b) => a.usedAt - b.usedAt,
      );
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
