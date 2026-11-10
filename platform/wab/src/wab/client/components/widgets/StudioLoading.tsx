import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";
import { useI18n } from "@/wab/client/i18n";
import * as React from "react";

export function StudioLoading() {
  const { t } = useI18n();
  const ownsLoadingSurface = React.useContext(LoadingAnimationContext);
  if (!ownsLoadingSurface) {
    return null;
  }
  return (
    <div className="studio-loading visible">
      <BrandLoading label={t("Loading project…")} />
    </div>
  );
}
