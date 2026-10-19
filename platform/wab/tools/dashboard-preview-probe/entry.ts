import { ensure } from "@/wab/shared/common";
import { compose } from "./snapshot";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";
let fixtures: { id: string; revision: number }[];
const fixtureIds: string[] = [];
const timings: Record<string, any>[] = [];
declare global {
  interface Window {
    coverProbe: ReturnType<typeof createProbe>;
  }
}
async function createEngine() {
  const frame = document.createElement("iframe");
  frame.id = "engine";
  frame.title = "Single client engine";
  frame.style.cssText = `position:fixed;left:${(window as any).captureReference ? 0 : -20000}px;top:0;width:1440px;height:1024px;border:0;z-index:10;pointer-events:none`;
  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("Host failed"));
  });
  frame.src = `/canvas-preview/index.html#live=true&origin=${encodeURIComponent(location.origin)}&staticBaseUrl=${encodeURIComponent(location.origin + "/static")}`;
  document.body.append(frame);
  try {
    await loaded;
    ensure((frame.contentWindow as any)?.coverEngine, "Probe renderer did not load");
    return frame;
  } catch (e) {
    frame.remove();
    throw e;
  }
}
const cacheVersion = `canvas-png-v4:${process.env.COMMITHASH}`;
async function cacheDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("canvas-cover-probe", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("previews");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function cachedPreview(key: string, value?: Blob) {
  const bytes = await value?.arrayBuffer();
  const db = await cacheDb();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction("previews", value ? "readwrite" : "readonly");
      const req = value
        ? tx.objectStore("previews").put(bytes, key)
        : tx.objectStore("previews").get(key);
      let result: Blob | undefined;
      req.onsuccess = () => {
        result =
          value ??
          (req.result
            ? new Blob([req.result], { type: "image/png" })
            : undefined);
      };
      tx.oncomplete = () => resolve(result);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
async function generate(id: string) {
  const started = performance.now();
  const frame = await createEngine();
  const win = ensure(frame.contentWindow, "Engine window") as Window &
    Record<string, any>;
  const images: Array<{
    blob: Blob;
    width: number;
    height: number;
    left: number;
    top: number;
    name: string;
  }> = [];
  try {
    const payload = structuredClone(await win.coverEngine.load(id, ensure(fixtures.find((fixture) => fixture.id === id), "Fixture").revision, DEVFLAGS));
    timings.push(payload);
    for (const artboard of payload.pages) {
      frame.style.width = `${artboard.width}px`;
      frame.style.height = `${artboard.height}px`;
      await win.coverEngine.render(artboard.uuid);
      const label = `${id}-${artboard.uuid}`;
      if ((window as any).captureReference) {
        await (window as any).captureReference(
          label,
          artboard.width,
          artboard.height,
        );
      }
      const shot = await win.coverEngine.capture(
        artboard.width,
        artboard.height,
      );
      const blob = shot.blob;
      if ((window as any).captureResult) {
        await (window as any).captureResult(
          label,
          await dataUrl(blob),
          shot.stats,
        );
      }
      images.push({ ...artboard, blob });
    }
    const { blob, bounds, positions } = await compose(images);
    timings.push({
      id,
      arena: payload.arena,
      pages: images.length,
      bounds,
      positions,
      bytes: blob.size,
      generateMs: performance.now() - started,
    });
    return blob;
  } finally {
    win.coverEngine?.clear();
    frame.remove();
  }
}
async function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
function createProbe() {
  let active = 0,
    maxActive = 0,
    queue = Promise.resolve(),
    cacheHits = 0;
  const urls = new Set<string>();
  const knownRevisions = Object.fromEntries(fixtures.map((fixture) => [fixture.id, fixture.revision]));
  const get = (id: string) => {
    const job = queue.then(async () => {
      const key = `${id}:${knownRevisions[id]}:${cacheVersion}`;
      const hit = await cachedPreview(key);
      if (hit) {
        cacheHits++;
        return hit;
      }
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        const blob = await generate(id);
        await cachedPreview(key, blob);
        return blob;
      } finally {
        active--;
      }
    });
    queue = job.then(
      () => {},
      () => {},
    );
    return job;
  };
  return {
    timings,
    stats: () => ({
      active,
      maxActive,
      engines: document.querySelectorAll("#engine").length,
      images: document.querySelectorAll(".cover img").length,
      cacheHits,
      objectUrls: urls.size,
    }),
    async mount(count: number) {
      this.clear();
      const root = ensure(document.getElementById("root"), "Root");
      const jobs: Promise<void | undefined>[] = [];
      for (let i = 0; i < count; i++) {
        const card = document.createElement("div");
        card.className = "cover";
        root.append(card);
        jobs.push(
          get(fixtureIds[i % 2]).then((blob) => {
            if (!card.isConnected) {
              return;
            }
            const url = URL.createObjectURL(blob);
            urls.add(url);
            const img = document.createElement("img");
            img.src = url;
            card.append(img);
            return img.decode();
          }),
        );
      }
      await Promise.all(jobs);
    },
    clear() {
      document.getElementById("root")?.replaceChildren();
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    },
    async purge() {
      const db = await cacheDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("previews", "readwrite");
        const req = tx.objectStore("previews").clear();
        tx.oncomplete = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    async fidelity() {
      // Same engine, real Recharts SVG and native Canvas fixtures. Not business-project evidence.
      const frame = await createEngine();
      const win = ensure(frame.contentWindow, "Window") as Window &
        Record<string, any>;
      const doc = ensure(frame.contentDocument, "Document");
      try {
        await win.coverEngine.load(fixtures[0].id, fixtures[0].revision, DEVFLAGS);
        win.coverEngine.clear();
        frame.style.width = "1000px";
        frame.style.height = "800px";
        const script = doc.createElement("script");
        script.src = "/fixture/fidelity.js";
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Fidelity asset failed"));
          doc.body.append(script);
        });
        await win.renderFidelity();
        await win.coverEngine.ready();
        if ((window as any).captureReference) {
          await (window as any).captureReference("fidelity", 1000, 800);
        }
        const shot = await win.coverEngine.capture(1000, 800);
        const blob = shot.blob;
        if ((window as any).captureResult) {
          await (window as any).captureResult(
            "fidelity",
            await dataUrl(blob),
            shot.stats,
          );
        }
        win.clearFidelity();
        return shot.stats;
      } finally {
        frame.remove();
      }
    },
  };
}
(async () => {
  document.body.style.cssText =
    "margin:0;background:#15161b;color:#eee;font:14px system-ui";
  document.body.innerHTML =
    '<h1 style="font-size:18px;padding:16px">客户端画布预览验证</h1><div id="root"></div>';
  const css = document.createElement("style");
  css.textContent =
    "#root{display:grid;grid-template-columns:repeat(3,320px);gap:24px;padding:24px}.cover{position:relative;width:320px;height:180px;border:1px solid #555;border-radius:12px;overflow:hidden;background:#202128}.cover img{width:100%;height:100%;object-fit:contain}";
  document.head.append(css);
  const config = await fetch("/fixture/config.json").then((r) => r.json());
  applyDevFlagOverrides(config.config);
  fixtures = await fetch("/fixture/manifest.json").then((r) => r.json());
  fixtureIds.push(...fixtures.map((fixture) => fixture.id));
  window.coverProbe = createProbe();
  await window.coverProbe.mount(
    Number(new URLSearchParams(location.search).get("count") ?? 2),
  );
})().catch((e) => {
  document.body.innerText = e.stack;
});
