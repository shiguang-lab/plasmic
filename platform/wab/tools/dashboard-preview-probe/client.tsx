import { ProjectPreview } from "@/wab/client/components/dashboard/preview/ProjectPreview";
import { renderPreview } from "@/wab/client/components/dashboard/preview/client";
import { DEVFLAGS, applyDevFlagOverrides } from "@/wab/shared/devflags";
import React from "react";
import { createRoot } from "react-dom/client";

const fixtures: { id: string; revision: number }[] = await fetch("/fixture/manifest.json").then((r) => r.json());
const ids = fixtures.map((fixture) => fixture.id);
const root = createRoot(document.getElementById("root") as HTMLElement);
const config = await fetch("/fixture/config.json").then((r) => r.json());
applyDevFlagOverrides(config.config);
let controller: AbortController | undefined;
(window as any).previewTests = {
  ids,
  async generate(index: number) {
    controller = new AbortController();
    const blob = await renderPreview(
      {
        projectId: ids[index],
        revision: fixtures[index].revision,
        flags: DEVFLAGS,
        staticBaseUrl: location.origin + "/static",
      },
      controller.signal,
    );
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    image.className = "native-preview";
    document.body.append(image);
    await image.decode();
    URL.revokeObjectURL(url);
    return {
      bytes: blob.size,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  },
  cancel() {
    controller?.abort();
  },
  mount(count: number) {
    root.render(
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 320px)",
          gap: 16,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="card"
            style={{
              width: 320,
              height: 180,
              position: "relative",
              background: "#333",
            }}
          >
            <ProjectPreview
              userId="test"
              projectId={ids[i % 2]}
              updatedAt="2026-10-11"
            />
          </div>
        ))}
      </div>,
    );
  },
  clear() {
    root.render(null);
    document.querySelectorAll(".native-preview").forEach((img) => img.remove());
  },
  async purge() {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("plasmic-canvas-previews");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
