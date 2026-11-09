import { useModelSelector } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { CodeDisplay } from "@/wab/client/components/coding/CodeDisplay";
import sty from "@/wab/client/components/studio/code-preview/CodePreviewPanel.module.css";
import { Loadable } from "@/wab/client/components/widgets";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { exportReactPlainTypical } from "@/wab/shared/codegen/react-p/plain";
import React from "react";

function loadCodeFormatters() {
  return Promise.all([import("prettier/standalone"), import("prettier/plugins/typescript"), import("prettier/plugins/estree")]);
}

export const CodePreviewPanel = React.memo(function CodePreviewPanel(props: {
  studioCtx: StudioCtx;
}) {
  const { studioCtx } = props;
  const vc = useStudioSelection(studioCtx, (state) => state.view);
  const query = React.useCallback(() => vc ? exportReactPlainTypical(studioCtx.site, studioCtx.siteInfo.name, studioCtx.siteInfo.id, vc.component) : undefined, [studioCtx, vc]);
  const module = useModelSelector(studioCtx.modelRevisions, [modelKeys.site], query);
  if (module === undefined) { return null; }

  const loader = async () => {
    const [Prettier, parserTypeScript, printerEstree] = await loadCodeFormatters();
    return Prettier.format(module, {
      parser: "typescript",
      plugins: [parserTypeScript, printerEstree],
      trailingComma: "none",
    });
  };

  const contents = (formatted: string) => {
    return (
      <div className={sty.root}>
        <CodeDisplay language="tsx" className={sty.codeDisplay}>
          {formatted}
        </CodeDisplay>
      </div>
    );
  };

  return <Loadable<string> loader={loader} contents={contents} />;
});
