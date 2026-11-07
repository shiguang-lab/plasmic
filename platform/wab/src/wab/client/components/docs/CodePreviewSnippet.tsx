import { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { DocsPortalEditor } from "@/wab/client/components/docs/DocsPortalEditor";
import { DocsPreviewCanvas } from "@/wab/client/components/docs/DocsPreviewCanvas";
import {
  DefaultCodePreviewSnippetProps,
  PlasmicCodePreviewSnippet,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicCodePreviewSnippet";
import type { Component } from "@/wab/shared/model/classes";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import {
  PlumeDocsExample,
} from "@/wab/shared/plume/plume-registry";
import * as React from "react";
import { useStore } from "zustand";

export { makeCodePreviewSource } from "@/wab/client/components/docs/code-preview-source";

interface CodePreviewSnippetProps extends DefaultCodePreviewSnippetProps {
  component: ModelRef<Component>;
  docsCtx: DocsPortalCtx;
  example: PlumeDocsExample;
}

function CodePreviewSnippet(
  props: CodePreviewSnippetProps,
) {
  const { component, docsCtx, example, ...rest } = props;
  const useLoader = useStore(
    docsCtx.store,
    (state) => state.codegenType === "loader",
  );
  const initialCode = useStore(docsCtx.models.getExampleStore(component, example), (state) => useLoader ? state.loader : state.codegen);
  const codePreviewCtx = React.useMemo(
    () => new CodePreviewCtx(initialCode),
    [component, example.title, initialCode],
  );
  React.useEffect(() => codePreviewCtx.formatInitialCode(), [codePreviewCtx]);

  return (
    <PlasmicCodePreviewSnippet
      title={example.title}
      info={example.info || ""}
      viewport={
        <DocsPreviewCanvas docsCtx={docsCtx} codePreviewCtx={codePreviewCtx} />
      }
      editor={
        <DocsPortalEditor docsCtx={docsCtx} codePreviewCtx={codePreviewCtx} />
      }
      {...rest}
    />
  );
}

export default CodePreviewSnippet;
