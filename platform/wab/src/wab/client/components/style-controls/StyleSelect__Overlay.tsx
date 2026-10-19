import {
  DefaultStyleSelect__OverlayProps,
  PlasmicStyleSelect__Overlay,
} from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Overlay";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { TriggeredOverlayRef } from "@plasmicapp/react-web";
import { theme } from "antd";
import * as React from "react";

type StyleSelect__OverlayProps = DefaultStyleSelect__OverlayProps;

function StyleSelect__Overlay_(
  props: StyleSelect__OverlayProps,
  ref: TriggeredOverlayRef,
) {
  const { token } = theme.useToken();
  const { styles, cx } = useProductThemeStyles(token);
  const { plasmicProps } = PlasmicStyleSelect__Overlay.useBehavior(
    { ...props, className: cx(props.className, styles.root) },
    ref,
  );
  return (
    <PlasmicStyleSelect__Overlay
      root={
        {
          "data-plasmic-role": "overlay",
        } as any
      }
      {...plasmicProps}
    />
  );
}

const StyleSelect__Overlay = React.forwardRef(StyleSelect__Overlay_);

export default Object.assign(StyleSelect__Overlay, {
  __plumeType: "triggered-overlay",
});
