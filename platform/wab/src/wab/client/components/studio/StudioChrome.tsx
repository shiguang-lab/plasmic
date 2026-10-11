import { CanvasViewControls } from "@/wab/client/components/studio/CanvasViewControls";
import { EditorToolRail } from "@/wab/client/components/studio/EditorToolRail";
import { StudioLayout } from "@/wab/client/components/studio/StudioLayout";
import { TopBarChrome } from "@/wab/client/components/top-bar/TopBarChrome";
import { StudioLoading } from "@/wab/client/components/widgets";
import * as React from "react";

// Render the editor's shared chrome while its project model is being fetched.
export function StudioChrome({
  projectName,
  children,
}: {
  projectName?: string;
  children?: React.ReactNode;
}) {
  React.useEffect(() => {
    document.getElementById("studio-startup-loading")?.classList.add("fadeOut");
  }, []);
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
