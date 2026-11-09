import { useVariantsController } from "@/wab/client/studio-ctx/variant-controller-inputs";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";

export function useCurrentRecordingTarget(): "baseVariant" | "nonBaseVariant" {
  const studioCtx = useStudioCtx();

  const input = useVariantsController(studioCtx);
  return input?.activeVariants.some((variant) => input.variants[variant.uid]?.targeted) ? "nonBaseVariant" : "baseVariant";
}
