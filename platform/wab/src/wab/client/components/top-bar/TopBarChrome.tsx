import { TopBarLoading } from "@/wab/client/components/top-bar/TopBarLoading";
import PlasmicTopBar from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicTopBar";
import * as React from "react";

// The data-free header is also the header used by the initialized editor.
// Project-aware callers supply title, menus, permissions, and event handlers.
export function TopBarChrome({
  projectName,
  projectReady = false,
  ...props
}: React.ComponentProps<typeof PlasmicTopBar> & {
  projectName?: string;
  projectReady?: boolean;
}) {
  return projectReady ? <PlasmicTopBar {...props} /> : <TopBarLoading projectName={projectName} />;
}
