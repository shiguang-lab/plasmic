import * as React from "react";
import { PlasmicButton } from "./plasmic/create_plasmic_app/PlasmicButton";

function Button_(props, ref) {
  const { plasmicProps, rootOverride } = PlasmicButton.deriveBehaviorProps(props);
  return <PlasmicButton {...plasmicProps} overrides={{...plasmicProps.overrides, root: {...rootOverride, props: {...rootOverride.props, ref}}}} />;
}

const Button = React.forwardRef(Button_);

export default Object.assign(Button, { __plumeType: "button" });
