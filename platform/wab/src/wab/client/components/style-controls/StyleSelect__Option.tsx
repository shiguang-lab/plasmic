import { SelectContext, getDefaultPlasmicProps, PLUME_STRICT_MODE } from "@plasmicapp/react-web";
import {
  DefaultStyleSelect__OptionProps,
  PlasmicStyleSelect__Option,
} from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicStyleSelect__Option";
import { SelectOptionRef } from "@plasmicapp/react-web";
import * as React from "react";

type StyleSelect__OptionProps = DefaultStyleSelect__OptionProps;

function StyleSelect__Option_(props: StyleSelect__OptionProps, ref: SelectOptionRef) {
  const context = React.useContext(SelectContext);
  if (!context) {
    if (PLUME_STRICT_MODE) { throw new Error("You can only use a Select.Option within a Select component."); }
    const {plasmicProps} = getDefaultPlasmicProps(PlasmicStyleSelect__Option, props);
    return (
    <PlasmicStyleSelect__Option
      isUnsetOption={props.value == null}
      {...plasmicProps}
    />
  );
  }
  return <StyleSelect__OptionWithContext props={props} ref={ref} />;
}

function StyleSelect__OptionWithContext({props, ref}: {props: StyleSelect__OptionProps; ref: SelectOptionRef}) {
  const { plasmicProps } = PlasmicStyleSelect__Option.useBehavior(props, ref);
  return (
    <PlasmicStyleSelect__Option
      isUnsetOption={props.value == null}
      {...plasmicProps}
    />
  );
}

const StyleSelect__Option = React.forwardRef(StyleSelect__Option_);

export default Object.assign(StyleSelect__Option, {
  __plumeType: "select-option",
});
