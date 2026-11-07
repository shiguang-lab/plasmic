import CodePreviewSnippet from "@/wab/client/components/docs/CodePreviewSnippet";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import DocsPropsTableRow from "@/wab/client/components/docs/DocsPropsTableRow";
import { PlasmicComponentView } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicComponentView";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { Component } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

function ComponentView({ docsCtx }: { docsCtx: DocsPortalCtx }) {
  const component = useDocsFocusedComponentRef(docsCtx);
  return component ? <FocusedComponentView docsCtx={docsCtx} componentRef={component} /> : null;
}

function FocusedComponentView({ docsCtx, componentRef }: { docsCtx: DocsPortalCtx; componentRef: ModelRef<Component> }) {
  const component = useStore(docsCtx.models.getComponentStore(componentRef), useShallow((state) => ({ isPlume: state.isPlume, name: state.name, docsInfo: state.docsInfo, examples: state.examples, baseProps: state.baseProps, customProps: state.customProps, footer: state.footer })));
  const codegenType = useStore(docsCtx.store, (state) => state.codegenType);
  if (!component.isPlume) { return null; }
  return (
    <PlasmicComponentView
      title={component.name}
      info={component.docsInfo}
      examples={component.examples.map((example) => (
        <CodePreviewSnippet key={`${codegenType}_${example.title}`} component={componentRef} docsCtx={docsCtx} example={example} />
      ))}
      baseProps={{ rows: component.baseProps.map((prop) => <DocsPropsTableRow key={prop.name} prop={prop} />) }}
      hideCustomProps={!component.customProps.length}
      customProps={{ rows: component.customProps.map((prop) => <DocsPropsTableRow key={prop.name} prop={prop} />) }}
      componentType="plume"
      footer={component.footer}
    />
  );
}

export default ComponentView;
