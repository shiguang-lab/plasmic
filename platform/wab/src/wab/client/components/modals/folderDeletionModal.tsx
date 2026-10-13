import { confirm } from "@/wab/client/components/quick-modals";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import React from "react";

export async function promptDeleteFolder(itemType, path, itemCount = 0) {
  return confirm({
    title: <UiText message={"Confirm deletion"} />,
    confirmLabel: translate(getUiLocale(), "Delete"),
    message:
      itemCount > 0 ? (
        <UiText
          message={
            itemCount === 1
              ? "Are you sure you want to delete folder {path} and all its contents? It currently contains {count} item of type {type}."
              : "Are you sure you want to delete folder {path} and all its contents? It currently contains {count} items of type {type}."
          }
          values={{
            path,
            count: itemCount,
            type: translateUiLabel(getUiLocale(), itemType),
          }}
        />
      ) : (
        <UiText
          message="Are you sure you want to delete folder {path}?"
          values={{ path }}
        />
      ),
  });
}
