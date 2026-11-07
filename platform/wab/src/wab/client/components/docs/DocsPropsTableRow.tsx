import {
  DefaultDocsPropsTableRowProps,
  PlasmicDocsPropsTableRow,
  PlasmicDocsPropsTableRow__OverridesType,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPropsTableRow";
import { toVarName } from "@/wab/shared/codegen/util";
import { DocsContractProp } from "@/wab/client/components/docs/docs-model-projections";
import * as React from "react";

interface DocsPropsTableRowProps
  extends
    DefaultDocsPropsTableRowProps,
    PlasmicDocsPropsTableRow__OverridesType {
  prop: DocsContractProp;
}

function DocsPropsTableRow(props: DocsPropsTableRowProps) {
  const { prop, ...rest } = props;
  return (
    <PlasmicDocsPropsTableRow
      {...rest}
      propName={toVarName(prop.name)}
      description={prop.info}
      propType={prop.type}
    />
  );
}

export default DocsPropsTableRow;
