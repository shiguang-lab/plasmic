import { BottomModalsProvider } from "@/wab/client/components/BottomModal";
import { useDocsLayoutStyles } from "@/wab/client/components/docs/DocsLayout.styles";
import DocsPortalBranches from "@/wab/client/components/docs/DocsPortalBranches";
import {
  DocsPortalCtx,
  providesDocsPortalCtx,
} from "@/wab/client/components/docs/DocsPortalCtx";
import { TopFrameObserver } from "@/wab/client/components/studio/TopFrameObserver";
import { fixStudioIframePositionAndOverflow } from "@/wab/client/dom-utils";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { PlasmicDocsPortal } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicDocsPortal";
import CodegenTypeContext from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicGlobalVariant__CodegenType";
import { useHistory } from "@/wab/client/route/HistoryProvider";
import { Switch, switchCase, switchDefault } from "@/wab/client/route/Switch";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import * as React from "react";
import { useState } from "react";
import { useStore } from "zustand";

interface DocsPortalProps {
  hostFrameCtx: HostFrameCtx;
  studioCtx: StudioCtx;
}

function DocsPortal(props: DocsPortalProps) {
  const { studioCtx } = props;
  const { styles } = useDocsLayoutStyles();
  const history = useHistory();
  const [docsCtx] = useState(() => new DocsPortalCtx(studioCtx));
  const projectName = useStore(studioCtx.projectMetadataStore, (state) => state.name);
  React.useEffect(() => docsCtx.retainModelResources(), [docsCtx]);

  React.useEffect(() => {
    studioCtx.setDocsMode(true);
    fixStudioIframePositionAndOverflow();
    return () => {
      studioCtx.setDocsMode(false);
    };
  }, [studioCtx]);

  React.useEffect(() => {
    // First subscribes to update docsCtx on any redirect
    const disposeHistoryListener = history.listen(({ location }) => {
      docsCtx.updateStateFromRoute(history, location.pathname);
    });

    // Then, either initializes docsCtx state or redirects
    docsCtx.updateStateFromRoute(history, history.location.pathname);

    return () => {
      disposeHistoryListener();
    };
  }, [docsCtx]);

  const codegenType = useStore(docsCtx.store, (state) => state.codegenType);
  const tab = useStore(docsCtx.store, (state) => state.tab);

  return providesDocsPortalCtx(docsCtx)(
    <CodegenTypeContext.Provider
      value={codegenType === "loader" ? "loader2" : codegenType}
    >
      <TopFrameObserver />
      <Switch
        cases={[
          switchCase({
            route: APP_ROUTES.projectDocs,
            exact: true,
            render: () => <DocsPortalBranches />,
          }),
          switchDefault({
            render: () => (
              <BottomModalsProvider>
                <PlasmicDocsPortal
                  activeTab={tab}
                  docsPortalHeader={{ projectName }}
                  root={{
                    className: styles.root,
                    style: {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                    },
                  }}
                />
              </BottomModalsProvider>
            ),
          }),
        ]}
      />
    </CodegenTypeContext.Provider>,
  );
}

export default DocsPortal;
