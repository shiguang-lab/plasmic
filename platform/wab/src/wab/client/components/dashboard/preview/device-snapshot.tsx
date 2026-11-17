import { previewBounds } from "@/wab/client/components/dashboard/preview/layout";
import { DeviceFrame } from "@/wab/client/components/device-frame/DeviceFrame";
import type { DeviceFrameGeometry } from "@/wab/client/components/device-frame/device-frame";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Capture the shared shell separately so the page retains its CSS viewport. */
export function deviceFrameSnapshot(
  doc: Document,
  width: number,
  height: number,
  deviceFrame: DeviceFrameGeometry,
  css: string,
) {
  const bounds = previewBounds({ left: 0, top: 0, width, height, deviceFrame });
  const wrapper = doc.createElement("div");
  wrapper.innerHTML = renderToStaticMarkup(
    <div style={{ position: "absolute", left: -bounds.left, top: -bounds.top, width, height }}>
      <DeviceFrame frame={deviceFrame} />
    </div>,
  );
  const style = doc.createElement("style");
  style.textContent = css;
  wrapper.prepend(style);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`;
}
