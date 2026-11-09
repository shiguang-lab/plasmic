import { TriggeredOverlayContext, getDefaultPlasmicProps, PLUME_STRICT_MODE } from "@plasmicapp/react-web";
import {
  DefaultStyleSelect__OverlayProps,
  PlasmicStyleSelect__Overlay,
} from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Overlay";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { TriggeredOverlayRef } from "@plasmicapp/react-web";
import { theme as AntdTheme } from "antd";
import * as React from "react";

type StyleSelect__OverlayProps = DefaultStyleSelect__OverlayProps;

function StyleSelect__Overlay_(props: StyleSelect__OverlayProps, ref: TriggeredOverlayRef) {
  const context = React.useContext(TriggeredOverlayContext);
  if (!context) {
    if (PLUME_STRICT_MODE) { throw new Error("You can only use a triggered overlay with a TriggeredOverlayContext"); }
    const {plasmicProps} = getDefaultPlasmicProps(PlasmicStyleSelect__Overlay, props);
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
  return <StyleSelect__OverlayWithContext props={props} ref={ref} />;
}

function StyleSelect__OverlayWithContext({props, ref}: {props: StyleSelect__OverlayProps; ref: TriggeredOverlayRef}) {
  const { token } = AntdTheme.useToken();
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
