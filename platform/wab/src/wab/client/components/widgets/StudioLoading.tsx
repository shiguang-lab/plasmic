import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { useI18n } from "@/wab/client/i18n";
import * as React from "react";

export function StudioLoading() {
  const { t } = useI18n();
  return (
    <div className="studio-loading visible">
      <BrandLoading label={t("Loading project…")} />
    </div>
  );
}
