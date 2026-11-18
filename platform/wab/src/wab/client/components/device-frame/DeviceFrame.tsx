import styles from "@/wab/client/components/device-frame/DeviceFrame.module.scss";
import type { DeviceFrameGeometry } from "@/wab/client/components/device-frame/device-frame";
import React from "react";

/** Hardware surrounds the full authored screen without reserving system bars. */
export function DeviceFrame({ frame }: { frame: DeviceFrameGeometry }) {
  return (
    <div
      className={styles.frame}
      style={{
        inset: `${-frame.insetTop}px ${-frame.insetX}px ${-frame.insetBottom}px`,
        borderWidth: frame.bezel,
        borderRadius: frame.hardware === "home-button" ? 40 : frame.screenRadius + frame.bezel,
        "--device-radius": `${frame.screenRadius}px`,
      } as React.CSSProperties}
      aria-hidden="true"
      data-test-id="device-frame"
      data-device={frame.kind}
      data-hardware={frame.hardware}
      data-orientation={frame.landscape ? "landscape" : "portrait"}
    >
      <div className={styles.display}>
        {(frame.hardware === "island" || frame.hardware === "notch") && <span className={styles.cutout}><span className={styles.lens} /></span>}
      </div>
      {(frame.hardware === "tablet" || frame.hardware === "home-button") && <span className={styles.camera} />}
      {frame.hardware === "home-button" && <><span className={styles.speaker} /><span className={styles.homeButton} /></>}
      <span className={styles.powerButton} />
      <span className={styles.volumeButtons} />
      {frame.kind === "phone" && <span className={styles.silentButton} />}
    </div>
  );
}
