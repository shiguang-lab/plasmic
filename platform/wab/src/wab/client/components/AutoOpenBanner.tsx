import styles from "./AutoOpenBanner.module.less";
import PlasmicAutoOpenBanner, {
  DefaultAutoOpenBannerProps,
} from "@/wab/client/plasmic/plasmic_kit_alert_banner/PlasmicAutoOpenBanner";
import classNames from "classnames";
import * as React from "react";

export type AutoOpenBannerProps = DefaultAutoOpenBannerProps;

function AutoOpenBanner({ className, ...props }: AutoOpenBannerProps) {

  return (
    <PlasmicAutoOpenBanner
      {...props}
      className={classNames(styles.root, className)}
    />
  );
}

export default AutoOpenBanner;
