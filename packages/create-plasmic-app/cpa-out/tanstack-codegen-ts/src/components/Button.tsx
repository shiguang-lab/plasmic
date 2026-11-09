import * as React from "react";
import {
  PlasmicButton,
  DefaultButtonProps
} from "./plasmic/create_plasmic_app/PlasmicButton";

import {
  ButtonRef,
  HtmlAnchorOnlyProps,
  HtmlButtonOnlyProps
} from "@plasmicapp/react-web";

export interface ButtonProps extends DefaultButtonProps {
  // Feel free to add any additional props that this component should receive
}
function Button_(props: ButtonProps, ref: ButtonRef) {
  const { plasmicProps, rootOverride } = PlasmicButton.deriveBehaviorProps<ButtonProps>(props);
  return <PlasmicButton {...plasmicProps} overrides={{...plasmicProps.overrides, root: {...rootOverride, props: {...rootOverride.props, ref}}}} />;
}

export type ButtonComponentType = {
  (
    props: Omit<ButtonProps, HtmlAnchorOnlyProps> & {
      ref?: React.Ref<HTMLButtonElement>;
    }
  ): React.ReactElement;
  (
    props: Omit<ButtonProps, HtmlButtonOnlyProps> & {
      ref?: React.Ref<HTMLAnchorElement>;
    }
  ): React.ReactElement;
};
const Button = React.forwardRef(Button_) as any as ButtonComponentType;

export default Object.assign(Button, { __plumeType: "button" });
