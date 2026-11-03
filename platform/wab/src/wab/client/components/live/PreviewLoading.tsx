import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { useI18n } from "@/wab/client/i18n";
import * as React from "react";
import "./PreviewLoading.css";

export function PreviewLoading({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="preview-loading">
      {children ?? <BrandLoading label={t("Loading preview…")} />}
    </div>
  );
}
