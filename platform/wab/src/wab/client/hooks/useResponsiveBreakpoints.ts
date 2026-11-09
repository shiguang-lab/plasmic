import { useResponsivePanelInputs } from "@/wab/client/hooks/responsive-panel-inputs";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";

export function useResponsiveBreakpoints() {
  return useResponsivePanelInputs(useStudioCtx()).value;
}
