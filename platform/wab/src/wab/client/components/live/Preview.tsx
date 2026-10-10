import { usePreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { PreviewFrame } from "@/wab/client/components/live/PreviewFrame";
import { PreviewTopBar } from "@/wab/client/components/live/PreviewTopBar";
import { TopFrameObserver } from "@/wab/client/components/studio/TopFrameObserver";
import { useEditorLayoutStyles } from "@/wab/client/components/ui/layout-styles";
import { fixStudioIframePositionAndOverflow } from "@/wab/client/dom-utils";
import { PREVIEW_SHORTCUTS } from "@/wab/client/shortcuts/preview/preview-shortcuts";
import { useBindShortcutHandlers } from "@/wab/client/shortcuts/shortcut-handler";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawn } from "@/wab/shared/common";
import { observer } from "mobx-react";
import * as React from "react";

interface PreviewProps {
  studioCtx: StudioCtx;
}

const Preview = observer(function Preview(props: PreviewProps) {
  const { studioCtx } = props;
  const { styles } = useEditorLayoutStyles();
  const previewCtx = usePreviewCtx();
  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  }>();

  React.useEffect(() => {
    fixStudioIframePositionAndOverflow();
  }, [studioCtx]);

  useBindShortcutHandlers(
    document.body,
    PREVIEW_SHORTCUTS,
    !previewCtx.full
      ? {
          EXIT_PREVIEW_MODE: () => {
            spawn(previewCtx.toggleLiveMode());
          },
        }
      : {},
  );
  return (
    <div
      className={styles.root}
      style={{
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {!previewCtx.full && previewCtx.isLive && (
        <TopFrameObserver preview={true} />
      )}
      {!previewCtx.full && previewCtx.isLive && (
        <PreviewTopBar dimensions={dimensions} />
      )}
      <PreviewFrame
        previewCtx={previewCtx}
        onDimensionsChange={setDimensions}
      />
    </div>
  );
});

export default Preview;
