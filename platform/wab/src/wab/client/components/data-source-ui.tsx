import { translate, translateUiLabel } from "@/wab/client/i18n/locales";

import { AppCtx } from "@/wab/client/app-ctx";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import { getUiLocale } from "@/wab/client/i18n";
import { ApiDataSource } from "@/wab/shared/ApiSchema";
import { DATA_SOURCE_LOWER } from "@/wab/shared/Labels";

export async function confirmDeleteDataSource(
  appCtx: AppCtx,
  source: ApiDataSource,
  onUpdate: () => Promise<any>,
) {
  if (
    await reactConfirm({
      message: translate(
        getUiLocale(),
        "Are you sure you want to delete this {part1}?",
        { part1: translateUiLabel(getUiLocale(), DATA_SOURCE_LOWER) },
      ),
      confirmLabel: translate(getUiLocale(), "Delete"),
    })
  ) {
    await appCtx.api.deleteDataSource(source.id);
    await onUpdate();
  }
}
