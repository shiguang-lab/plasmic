import { Skeleton } from "antd";
import React from "react";

function observeCover(
  element: Element,
  projectId: string,
  setBlob: (value: Blob | undefined) => void,
) {
  const controller = new AbortController();
  let timer: number | undefined,
    loading = false,
    visible = false;
  async function refresh() {
    if (loading || !visible || controller.signal.aborted) return;
    loading = true;
    try {
      const res = await fetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/cover`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (res.status === 200) {
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        setBlob(blob);
      } else if (
        res.status === 401 ||
        res.status === 403 ||
        res.status === 404
      ) {
        setBlob(undefined);
      }
      if (res.headers.has("Retry-After") && !controller.signal.aborted) {
        timer = window.setTimeout(refresh, 10_000);
      }
    } catch {
      // A disconnected client keeps its last image and retries on the next visit.
    }
    loading = false;
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    window.clearTimeout(timer);
    if (visible) void refresh();
  });
  observer.observe(element);
  return () => {
    controller.abort();
    observer.disconnect();
    window.clearTimeout(timer);
  };
}

/** Visible cards read the last successful server cover while its replacement renders. */
export function ProjectPreview({
  projectId,
  updatedAt,
}: {
  projectId: string;
  updatedAt: string;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const [src, setSrc] = React.useState<string>();
  const [blob, setBlob] = React.useState<Blob>();
  React.useEffect(() => {
    if (!blob) {
      setSrc(undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  React.useEffect(() => {
    if (root.current) return observeCover(root.current, projectId, setBlob);
  }, [projectId, updatedAt]);
  return (
    <div
      ref={root}
      style={{ position: "absolute", inset: 0, background: "#e8e9ef" }}
    >
      {!src && (
        <Skeleton.Node
          active={false}
          style={{ width: "100%", height: "100%", borderRadius: 0 }}
        />
      )}
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
    </div>
  );
}
