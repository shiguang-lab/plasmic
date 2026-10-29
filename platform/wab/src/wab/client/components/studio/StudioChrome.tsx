import { openDesktopBrowser } from "@/wab/client/desktop-browser";
import { parseProjectLocation } from "@/wab/client/cli-routes";
import { PreviewLoading } from "@/wab/client/components/live/PreviewLoading";
import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { EditorToolRail } from "@/wab/client/components/studio/EditorToolRail";
import { StudioLayout } from "@/wab/client/components/studio/StudioLayout";
import { TopBarLoading } from "@/wab/client/components/top-bar/TopBarLoading";
import { editorLeftRailLayout } from "@/wab/client/components/ui/layout-styles";
import { StudioLoading } from "@/wab/client/components/widgets/StudioLoading";
import { useLocation } from "@/wab/client/route/HistoryProvider";
import { ensure, spawn } from "@/wab/shared/common";
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
  const projectLocation = parseProjectLocation(location);
  const projectId = projectLocation?.projectId;
  const [startupLoading] = React.useState(() =>
    document.getElementById("studio-startup-loading"),
  );
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
    // Keep the HTML skeleton in place: replacing or moving its animated nodes
    // restarts the shimmer when React takes over the first paint.
    const visible =
      !!projectId &&
      !projectLocation?.isPreview &&
      !state.ready &&
      !state.hidden &&
      !state.failure;
    startupLoading?.classList.add("studio-loading--managed", "visible");
    startupLoading?.classList.toggle("fadeOut", !visible);
    document
      .getElementById("preview-startup-loading")
      ?.classList.add("fadeOut");
    return () => startupLoading?.classList.add("fadeOut");
  }, [
    startupLoading,
    projectId,
    projectLocation?.isPreview,
    state.ready,
    state.hidden,
    state.failure,
  ]);
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
          {/* Failures render here, outside the route boundary that reported
              them, and can themselves suspend while sign-in loads. */}
          <React.Suspense
            fallback={projectLocation?.isPreview ? (
              <PreviewLoading />
            ) : (
              <StudioChromeContent projectName={state.projectName} />
            )}
          >
            {projectLocation?.isPreview ? (
              <PreviewLoading>{state.failure}</PreviewLoading>
            ) : (
              <StudioChromeContent
                projectName={state.projectName}
                loading={!startupLoading}
              >
                {state.failure}
              </StudioChromeContent>
            )}
          </React.Suspense>
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
  const location = useLocation();
  const isPreview = parseProjectLocation(location)?.isPreview;
  React.useLayoutEffect(() => {
    if (update && children) {
      update({ failure: children });
      return () => update({ failure: undefined });
    }
    return undefined;
  }, [update, children]);
  return update ? null : isPreview ? (
    <PreviewLoading>{children}</PreviewLoading>
  ) : (
    <StudioChromeContent projectName={projectName}>
      {children}
    </StudioChromeContent>
  );
}

function StudioChromeContent({
  projectName,
  children,
  loading = true,
}: {
  projectName?: string;
  children?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <StudioLayout>
      <div className="canvas-editor">
        <div className="canvas-editor__outer-main-area">
          <div className="canvas-editor__top-bar">
            <TopBarLoading projectName={projectName} />
          </div>
          <div className="canvas-editor__hsplit">
            <div
              className="canvas-editor__left-pane-container"
              style={{
                position: "absolute",
                left: editorLeftRailLayout.left,
                top: editorLeftRailLayout.top,
                bottom: editorLeftRailLayout.bottom,
              }}
            >
              <EditorToolRail onOpenWebBrowser={() => spawn(openDesktopBrowser())} />
            </div>
            <div className="canvas-editor__canvas-container">
              {children ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {children}
                </div>
              ) : loading ? (
                <StudioLoading />
              ) : null}
              <CanvasViewControls />
            </div>
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
