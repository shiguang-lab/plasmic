import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import Option from "@/wab/client/components/widgets/Select__Option";
import OptionGroup from "@/wab/client/components/widgets/Select__OptionGroup";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultSelectProps,
  PlasmicSelect,
} from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicSelect";
import { SelectRef } from "@plasmicapp/react-web";
import * as React from "react";

type SelectProps = DefaultSelectProps;

function Select_(props: SelectProps, ref: SelectRef) {
  const { plasmicProps, state: _state } = PlasmicSelect.useBehavior(
    {
      ...props,
      placeholder: props.placeholder ?? <UiText message="Select..." />,
    },
    ref,
  );
  if (React.useContext(InspectorReadOnly)) { return <span>{plasmicProps.args.selectedContent ?? props.value ?? "—"}</span>; }
  return <PlasmicSelect {...plasmicProps} />;
}

const Select = React.forwardRef(Select_);

export default Object.assign(Select, {
  Option,
  OptionGroup,
  __plumeType: "select",
});
