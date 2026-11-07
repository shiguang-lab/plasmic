import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { PropValueEditor } from "@/wab/client/components/sidebar-tabs/PropValueEditor";
import { PlasmicLinkedProp } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicLinkedProp";
import { ensure } from "@/wab/shared/common";
import { DocsLinkedProp } from "@/wab/client/components/docs/docs-model-projections";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import { Tooltip } from "antd";
import * as React from "react";
import { useStore } from "zustand";

interface LinkedPropProps {
  docsCtx: DocsPortalCtx;
  param: DocsLinkedProp;
}

function LinkedProp(props: LinkedPropProps) {
  const { docsCtx, param: property } = props;
  const componentRef = ensure(useDocsFocusedComponentRef(docsCtx), "Missing focused component");
  const component = docsCtx.models.snapshots.resolve(componentRef);
  const param = docsCtx.models.snapshots.resolve(property.param);
  const value = useStore(docsCtx.getComponentStore(component), (state) =>
    state.toggles.get(param),
  );
  const tsType = property.type;
  return (
    <PlasmicLinkedProp
      label={property.varName}
      type={
        <Tooltip title={<code>{tsType}</code>}>
          <span>{tsType}</span>
        </Tooltip>
      }
      children={
        <PropValueEditor
          label={property.name}
          attr={property.name}
          propType={property.propType}
          value={value}
          disabled={false}
          onChange={(newVal) =>
            docsCtx.setComponentToggle(component, param, newVal)
          }
        />
      }
    />
  );
}

export default LinkedProp;
