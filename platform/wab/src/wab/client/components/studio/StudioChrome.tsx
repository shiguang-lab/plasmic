import { parseProjectLocation } from "@/wab/client/cli-routes";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { EditorToolRail } from "@/wab/client/components/studio/EditorToolRail";
import { StudioLayout } from "@/wab/client/components/studio/StudioLayout";
import { TopBarChrome } from "@/wab/client/components/top-bar/TopBarChrome";
import { StudioLoading } from "@/wab/client/components/widgets";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { ensure } from "@/wab/shared/common";
import * as React from "react";

interface StudioStartupState {
  projectName?: string;
  ready: boolean;
  hidden: boolean;
  failure?: React.ReactNode;
}

const StudioStartupContext = React.createContext<
  ((state: Partial<StudioStartupState>) => void) | undefined
>(undefined);

export function useStudioStartup() {
  return ensure(
    React.useContext(StudioStartupContext),
    "Missing Studio startup boundary",
  );
}

// This owner lives above application loading and route Suspense, so replacing
// their fallback trees cannot replace the visible skeleton or restart its animation.
export function StudioStartupBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const projectId = parseProjectLocation(location)?.projectId;
  const [state, setState] = React.useState<
    StudioStartupState & { projectId?: string }
  >({
    projectId,
    ready: false,
    hidden: false,
  });
  if (state.projectId !== projectId) {
    setState({ projectId, ready: false, hidden: false });
  }
  const update = React.useCallback((patch: Partial<StudioStartupState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);
  React.useLayoutEffect(() => {
    document.getElementById("studio-startup-loading")?.classList.add("fadeOut");
  }, []);
  return (
    <>
      <StudioStartupContext.Provider value={update}>
        {children}
      </StudioStartupContext.Provider>
      {projectId && !state.ready && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 35,
            visibility: state.hidden ? "hidden" : "visible",
          }}
        >
          <StudioChromeContent projectName={state.projectName}>
            {state.failure}
          </StudioChromeContent>
        </div>
      )}
    </>
  );
}

// Top-frame fallbacks report errors to the persistent owner. Host-frame
// fallbacks render locally underneath that owner until the canvas is ready.
export function StudioChrome({
  projectName,
  children,
}: {
  projectName?: string;
  children?: React.ReactNode;
}) {
  const update = React.useContext(StudioStartupContext);
  React.useLayoutEffect(() => {
    if (update && children) {
      update({ failure: children });
      return () => update({ failure: undefined });
    }
  }, [update, children]);
  return update ? null : (
    <StudioChromeContent projectName={projectName}>
      {children}
    </StudioChromeContent>
  );
}

function StudioChromeContent({
  projectName,
  children,
}: {
  projectName?: string;
  children?: React.ReactNode;
}) {
  return (
    <StudioLayout>
      <div className="canvas-editor">
        <div className="canvas-editor__outer-main-area">
          <div className="canvas-editor__top-bar">
            <TopBarChrome projectName={projectName} />
          </div>
          <div className="canvas-editor__hsplit">
            <div
              className="canvas-editor__left-pane-container"
              style={{
                position: "absolute",
                left: 16,
                top: 82,
                height: "calc(100dvh - 170px)",
              }}
            >
              <EditorToolRail />
            </div>
            <div className="canvas-editor__canvas-container">
              {children ? (
                <div style={{ padding: 24 }}>{children}</div>
              ) : (
                <StudioLoading />
              )}
              <CanvasViewControls />
            </div>
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
