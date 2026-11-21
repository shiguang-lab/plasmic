import styles from "../../product-ui-theme.module.less";
import { cx } from "@/wab/shared/common";
import { TriggeredOverlayContext, getDefaultPlasmicProps, PLUME_STRICT_MODE } from "@plasmicapp/react-web";
import {
  DefaultSelect__OverlayProps,
  PlasmicSelect__Overlay,
} from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect__Overlay";
import { TriggeredOverlayRef } from "@plasmicapp/react-web";
import { theme as AntdTheme } from "antd";
import * as React from "react";

type Select__OverlayProps = DefaultSelect__OverlayProps;

function Select__Overlay_(props: Select__OverlayProps, ref: TriggeredOverlayRef) {
  const context = React.useContext(TriggeredOverlayContext);
  if (!context) {
    if (PLUME_STRICT_MODE) { throw new Error("You can only use a triggered overlay with a TriggeredOverlayContext"); }
    const {plasmicProps} = getDefaultPlasmicProps(PlasmicSelect__Overlay, props);
    return (
    <PlasmicSelect__Overlay
      root={{ "data-plasmic-role": "overlay" } as any}
      {...plasmicProps}
    />
  );
  }
  return <Select__OverlayWithContext props={props} ref={ref} />;
}

function Select__OverlayWithContext({props, ref}: {props: Select__OverlayProps; ref: TriggeredOverlayRef}) {
  const { token } = AntdTheme.useToken();

  const { plasmicProps } = PlasmicSelect__Overlay.useBehavior(
    { ...props, className: cx(props.className, styles.root) },
    ref,
  );
  return (
    <PlasmicSelect__Overlay
      root={{ "data-plasmic-role": "overlay" } as any}
      {...plasmicProps}
    />
  );
}

const Select__Overlay = React.forwardRef(Select__Overlay_);

export default Object.assign(Select__Overlay, {
  __plumeType: "triggered-overlay",
});
