import { subscribePreview } from "@/wab/client/components/dashboard/preview/client";
import { previewCanvasBackground } from "@/wab/client/components/dashboard/preview/types";
import { Skeleton } from "antd";
import React from "react";

export function ProjectPreview({
  userId,
  projectId,
  updatedAt,
}: {
  userId: string;
  projectId: string;
  updatedAt: string;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const [src, setSrc] = React.useState<string>();
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">(
    "loading",
  );
  React.useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    let unsubscribe: (() => void) | undefined, url: string | undefined;
    let visible = false,
      attempted = false;
    const release = () => {
      unsubscribe?.();
      unsubscribe = undefined;
      if (url) {
        URL.revokeObjectURL(url);
        url = undefined;
      }
      setSrc(undefined);
      setStatus("loading");
    };
    const update = () => {
      if (visible && document.visibilityState !== "hidden") {
        if (unsubscribe || attempted) {
          return;
        }
        attempted = true;
        unsubscribe = subscribePreview(userId, projectId, (blob) => {
          if (!blob) {
            setStatus("failed");
            return;
          }
          if (url) {
            URL.revokeObjectURL(url);
          }
          url = URL.createObjectURL(blob);
          setSrc(url);
        });
      } else {
        release();
        attempted = false;
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      release();
    };
  }, [userId, projectId, updatedAt]);
  return (
    <div
      ref={root}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {status !== "ready" && (
        <Skeleton.Node
          active={status === "loading"}
          styles={{
            root: {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            },
          }}
          style={{ width: "100%", height: "100%", borderRadius: 0 }}
        />
      )}
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: previewCanvasBackground,
            visibility: status === "ready" ? "visible" : "hidden",
          }}
          onLoad={() => setStatus("ready")}
          onError={() => {
            setSrc(undefined);
            setStatus("failed");
          }}
        />
      )}
    </div>
  );
}
