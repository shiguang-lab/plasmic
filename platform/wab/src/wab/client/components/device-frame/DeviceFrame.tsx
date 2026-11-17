import styles from "@/wab/client/components/device-frame/DeviceFrame.module.scss";
import type { DeviceFrameGeometry } from "@/wab/client/components/device-frame/device-frame";
import React from "react";

/** A sibling of the iframe, never a wrapper around business content. */
export function DeviceFrame({ frame }: { frame: DeviceFrameGeometry }) {
  return (
    <div
      className={`${styles.frame} ${frame.kind === "tablet" ? styles.tablet : ""} ${frame.landscape ? styles.landscape : ""}`}
      style={{
        inset: `${-frame.insetY}px ${-frame.insetX}px`,
        borderWidth: `${frame.insetY}px ${frame.insetX}px`,
        borderRadius: frame.screenRadius + frame.insetX,
      }}
      aria-hidden="true"
      data-test-id="device-frame"
      data-device={frame.kind}
    >
      <span className={styles.camera} />
      <span className={styles.home} />
      <span className={styles.buttons} />
      <span className={styles.volumeButtons} />
    </div>
  );
}
