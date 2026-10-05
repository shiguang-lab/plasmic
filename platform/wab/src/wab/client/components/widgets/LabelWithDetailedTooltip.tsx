import { InfoTooltip } from "@/wab/client/components/widgets/InfoTooltip";
import styles from "@/wab/client/components/widgets/LabelWithDetailedTooltip.module.scss";
import React, { ReactNode } from "react";

export function LabelWithDetailedTooltip(props: {
  tooltip: ReactNode | (() => React.ReactNode);
  children: ReactNode;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.label}>{props.children}</div>
      <div
        className={`LabelWithDetailedTooltip__InfoIcon ml-xsm inline-block ${styles.infoIcon}`}
      >
        <InfoTooltip tooltip={props.tooltip} />
      </div>
    </div>
  );
}
