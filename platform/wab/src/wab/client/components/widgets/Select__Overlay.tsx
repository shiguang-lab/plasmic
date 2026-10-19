import {
  DefaultSelect__OverlayProps,
  PlasmicSelect__Overlay,
} from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect__Overlay";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { TriggeredOverlayRef } from "@plasmicapp/react-web";
import { theme } from "antd";
import * as React from "react";

type Select__OverlayProps = DefaultSelect__OverlayProps;

function Select__Overlay_(
  props: Select__OverlayProps,
  ref: TriggeredOverlayRef,
) {
  const { token } = theme.useToken();
  const { styles, cx } = useProductThemeStyles(token);
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
