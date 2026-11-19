import { Skeleton } from "antd";
import React from "react";
import { observeCover } from "./cover-subscriptions";

/** Visible cards read the last successful server cover while its replacement renders. */
export function ProjectPreview({
  projectId,
  account,
}: {
  projectId: string;
  account: string;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const [src, setSrc] = React.useState<string>();
  React.useLayoutEffect(() => {
    if (!root.current) return;
    return observeCover(root.current, account, projectId, setSrc);
  }, [account, projectId]);
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
