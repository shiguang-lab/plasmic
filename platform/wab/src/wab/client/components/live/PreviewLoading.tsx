import { BrandLoading } from "@/wab/client/components/widgets/BrandLoading";
import { useI18n } from "@/wab/client/i18n";
import * as React from "react";
import "@/wab/client/components/live/PreviewLoading.css";

export function PreviewLoading({
  children,
  loading = true,
}: {
  children?: React.ReactNode;
  loading?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="preview-loading">
      {children ?? (loading && <BrandLoading label={t("Loading preview…")} />)}
    </div>
  );
}
