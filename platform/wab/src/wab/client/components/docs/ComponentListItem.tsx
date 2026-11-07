import { PublicLink } from "@/wab/client/components/PublicLink";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { PlasmicComponentListItem } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicComponentListItem";
import { toClassName } from "@/wab/shared/codegen/util";
import { asOne } from "@/wab/shared/common";
import { DocsComponentRow, useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import * as React from "react";
import { useStore } from "zustand";

interface ComponentListItemProps {
  docsCtx: DocsPortalCtx;
  component: DocsComponentRow;
}

function ComponentListItem(
  props: ComponentListItemProps,
) {
  const { component, docsCtx } = props;
  const projectId = useStore(docsCtx.studioCtx.projectMetadataStore, (state) => state.id);
  const focused = useDocsFocusedComponentRef(docsCtx);
  const selected = focused === component.ref;
  const codegenType = useStore(docsCtx.store, (state) => state.codegenType);
  const url = APP_ROUTES.projectDocsComponent.fill({
    projectId,
    componentIdOrClassName: toClassName(component.name) || component.uuid,
    codegenType: codegenType,
  });
  return (
    <PlasmicComponentListItem
      isSelected={selected}
      root={{
        render: ({ children, ...rest }) => {
          return (
            <PublicLink
              {...(rest as any)}
              children={asOne(children)}
              href={url}
            />
          );
        },
      }}
    >
      {component.name}
    </PlasmicComponentListItem>
  );
}

export default ComponentListItem;
