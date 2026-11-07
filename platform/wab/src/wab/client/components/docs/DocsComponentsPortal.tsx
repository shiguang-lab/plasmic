import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { DocsPortalEditor } from "@/wab/client/components/docs/DocsPortalEditor";
import { DocsPreviewCanvas } from "@/wab/client/components/docs/DocsPreviewCanvas";
import {
  DefaultDocsComponentsPortalProps,
  PlasmicDocsComponentsPortal,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsComponentsPortal";
import * as React from "react";
import { useStore } from "zustand";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { createStore } from "zustand/vanilla";

type DocsComponentsPortalProps = DefaultDocsComponentsPortalProps;

const emptyComponent = createStore(() => null);

function DocsComponentsPortal(props: DocsComponentsPortalProps) {
  const docsCtx = useDocsPortalCtx();
  const component = useDocsFocusedComponentRef(docsCtx);
  const store: ModelFieldStore<unknown> = component ? docsCtx.models.snapshots.field(docsCtx.models.snapshots.resolve(component), "plumeInfo") : emptyComponent;
  const isPlume = useStore(store, (state) => !!state);
  return (
    <PlasmicDocsComponentsPortal
      {...props}
      editor={<DocsPortalEditor docsCtx={docsCtx} />}
      viewport={<DocsPreviewCanvas docsCtx={docsCtx} />}
      componentType={isPlume ? "plume" : undefined}
      componentView={{ docsCtx }}
    />
  );
}

export default DocsComponentsPortal;
