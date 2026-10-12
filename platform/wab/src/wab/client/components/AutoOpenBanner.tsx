import PlasmicAutoOpenBanner, {
  DefaultAutoOpenBannerProps,
} from "@/wab/client/plasmic/plasmic_kit_alert_banner/PlasmicAutoOpenBanner";
import bannerStyles from "@/wab/client/plasmic/plasmic_kit_alert_banner/PlasmicBanner.module.css";
import { createStyles } from "antd-style";
import classNames from "classnames";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  root: {
    background: token.colorBgElevated,
    borderColor: token.colorBorderSecondary,
    boxShadow: token.boxShadowSecondary,
    [`& .${bannerStyles.icon}, & .${bannerStyles.text___0Krq3}`]: {
      color: token.colorTextSecondary,
    },
  },
}));

export type AutoOpenBannerProps = DefaultAutoOpenBannerProps;

function AutoOpenBanner({ className, ...props }: AutoOpenBannerProps) {
  const { styles } = useStyles();
  return (
    <PlasmicAutoOpenBanner
      {...props}
      className={classNames(styles.root, className)}
    />
  );
}

export default AutoOpenBanner;
