import styles from "@/wab/client/components/device-frame/DeviceFrame.module.scss";
import type { DeviceFrameGeometry } from "@/wab/client/components/device-frame/device-frame";
import React from "react";

/** Vector status symbols stay crisp at any canvas zoom and in exported covers. */
function StatusSymbols({ tablet }: { tablet: boolean }) {
  return (
    <div className={styles.symbols}>
      {!tablet && <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor">
        <rect y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" />
        <rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" width="3" height="12" rx="1" />
      </svg>}
      <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
        <path d="M.3 3.3a12.2 12.2 0 0 1 16.4 0l-1.8 1.9a9.5 9.5 0 0 0-12.8 0Zm3.1 3.2a7.6 7.6 0 0 1 10.2 0l-1.8 1.9a4.9 4.9 0 0 0-6.6 0Zm3.1 3.2a3 3 0 0 1 4 0l-2 2.1Z" />
      </svg>
      {tablet && <span className={styles.percentage}>100%</span>}
      <svg width="27" height="13" viewBox="0 0 27 13" fill="currentColor">
        <rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".35" />
        <rect x="2.5" y="2.5" width="19" height="8" rx="1.5" />
        <path opacity=".4" d="M25 4v5a2.6 2.6 0 0 0 0-5Z" />
      </svg>
    </div>
  );
}

/** A sibling of the iframe, with dedicated system areas outside business content. */
export function DeviceFrame({ frame }: { frame: DeviceFrameGeometry }) {
  return (
    <div
      className={styles.frame}
      style={{
        inset: `${-frame.insetTop}px ${-frame.insetX}px ${-frame.insetBottom}px`,
        borderWidth: frame.bezel,
        borderRadius: frame.hardware === "home-button" ? 40 : frame.screenRadius + frame.bezel,
        "--device-status-height": `${frame.statusBarHeight}px`,
        "--device-home-height": `${frame.homeHeight}px`,
        "--device-safe-x": `${frame.safeX}px`,
        "--device-radius": `${frame.screenRadius}px`,
      } as React.CSSProperties}
      aria-hidden="true"
      data-test-id="device-frame"
      data-device={frame.kind}
      data-hardware={frame.hardware}
      data-orientation={frame.landscape ? "landscape" : "portrait"}
    >
      <div className={styles.display}>
        {frame.statusBarHeight > 0 && <div className={styles.statusBar} data-test-id="device-status-bar">
          <span className={styles.time}>9:41</span>
          <StatusSymbols tablet={frame.kind === "tablet"} />
        </div>}
        {frame.safeX > 0 && <><div className={styles.safeLeft} /><div className={styles.safeRight} /></>}
        {frame.homeHeight > 0 && <div className={styles.homeArea}><span className={styles.home} /></div>}
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
