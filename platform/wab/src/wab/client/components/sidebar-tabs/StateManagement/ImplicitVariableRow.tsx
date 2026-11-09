import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { useVariableRow } from "@/wab/client/components/sidebar-tabs/StateManagement/useVariableRow";
import { ValuePreview } from "@/wab/client/components/sidebar-tabs/data-tab";
import LabeledListItem from "@/wab/client/components/widgets/LabeledListItem";
import { DefaultVariableRowProps } from "@/wab/client/plasmic/plasmic_kit_state_management/PlasmicVariableRow";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert } from "@/wab/shared/common";
import { Component, State } from "@/wab/shared/model/classes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import * as React from "react";

export interface ImplicitVariableRowProps extends DefaultVariableRowProps {
  component: Component;
  state: State;
  viewCtx: ViewCtx;
  sc: StudioCtx;
}

const ImplicitVariableRow = React.memo(React.forwardRef(function (
    props: ImplicitVariableRowProps,
    ref: HTMLElementRefOf<"div">,
  ) {
    const { component, state, sc, viewCtx, ...rest } = props;
    const {
      menu,
      modals,
      inputs,
      props: variableRowProps,
    } = useVariableRow({ sc, component, state, viewCtx });

    assert(inputs.hasTpl, "implicit states should have a tpl node");

    return (
      <WithContextMenu overlay={menu} onClick={(e) => e.stopPropagation()}>
        <LabeledListItem
          uiId={mkModelUiId(state.param)}
          data-test-id={inputs.variableName}
          data-test-type="implicit-variable-row"
          nesting="simple"
          ref={ref}
          valueSetState={variableRowProps.hasTempValue ? "isSet" : undefined}
          label={
            <label className="text-ellipsis-wrappable">
              {variableRowProps.name}
            </label>
          }
          onClick={
            // There is nothing to configure for implicit states in page
            // components. We do not add the `onClick` handler to
            // avoid opening an empty modal.
            inputs.isPage
              ? undefined
              : variableRowProps.showVariableConfigModal
          }
          menu={menu}
          padding={"noHorizontal"}
          withIcon
          icon={<div className="property-connector-line-icon" />}
          {...rest}
        >
          <ValuePreview
            onClick={variableRowProps.showValueConfigModal}
            val={variableRowProps.value}
          />
        </LabeledListItem>
        {modals}
      </WithContextMenu>
    );
  }));
export default ImplicitVariableRow;
