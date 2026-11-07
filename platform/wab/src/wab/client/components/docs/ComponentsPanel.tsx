import ComponentListItem from "@/wab/client/components/docs/ComponentListItem";
import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { Matcher } from "@/wab/client/components/view-common";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultComponentsPanelProps,
  PlasmicComponentsPanel,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicComponentsPanel";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert } from "antd";
import { useStore } from "zustand";
import * as React from "react";

type ComponentsPanelProps = DefaultComponentsPanelProps;

function ComponentsPanel(
  props: ComponentsPanelProps,
) {
  const { t: studioUiT } = useI18n();

  const docsCtx = useDocsPortalCtx();
  const [query, setQuery] = React.useState("");
  const matcher = new Matcher(query);
  const componentRows = useStore(docsCtx.models.getDirectoryStore(), (state) => state.components);
  const components = componentRows.filter((component) => matcher.matches(component.name));

  return (
    <PlasmicComponentsPanel
      {...props}
      componentsContainer={{
        as: Scrollbar,
        style: { flex: 1, minHeight: 0, height: "auto", overflow: "hidden" },
        props: { scrollX: false },
      }}
      searchbox={{
        value: query,
        onChange: (e) => setQuery(e.target.value),
        autoFocus: true,
      }}
    >
      <>
        {components.map((comp) => (
          <ComponentListItem
            key={comp.ref.uid}
            component={comp}
            docsCtx={docsCtx}
          />
        ))}

        {components.length === 0 && (
          <Alert
            className="m-m"
            style={{ width: "100%" }}
            type="warning"
            showIcon
            message={studioUiT("No components.")}
          />
        )}
      </>
    </PlasmicComponentsPanel>
  );
}

export default ComponentsPanel;
