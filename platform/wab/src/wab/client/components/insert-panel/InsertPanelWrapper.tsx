import InsertPanel from "@/wab/client/components/insert-panel/InsertPanel";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import { useDismissibleStudioOverlay } from "@/wab/client/hooks/useDismissibleStudioOverlay";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { observer } from "mobx-react";
import React from "react";

/** Insert content uses the shared left shell and retains its outside-dismiss behavior. */
const InsertPanelWrapper = observer(function InsertPanelWrapper() {
  const studioCtx = useStudioCtx();
  const ref = React.useRef<HTMLDivElement>(null);
  useDismissibleStudioOverlay({
    overlayRef: ref,
    isOpen: studioCtx.showAddDrawer(),
    onDismiss: (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("#left-tab-strip, .sidebar-popover")
      ) {
        return;
      }
      if (!isAnyModalOpen() && !studioCtx.leftTabGroup) {
        studioCtx.setShowAddDrawer(false);
      }
    },
  });
  return (
    <div ref={ref} className="flex-col flex-fill overflow-hidden">
      <InsertPanel onClose={() => studioCtx.setShowAddDrawer(false)} />
    </div>
  );
});
export default InsertPanelWrapper;
