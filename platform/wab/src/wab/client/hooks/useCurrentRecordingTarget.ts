import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";

export function useCurrentRecordingTarget(): "baseVariant" | "nonBaseVariant" {
  const studioCtx = useStudioCtx();

  const variantsController = makeVariantsController(studioCtx);
  const activeVariants = variantsController?.getActiveNonBaseVariants() ?? [];
  const targetedVariants = activeVariants?.filter((it) =>
    variantsController?.isTargeted(it),
  );

  return targetedVariants.length > 0 ? "nonBaseVariant" : "baseVariant";
}
