import { confirm } from "@/wab/client/components/quick-modals";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import React from "react";

export async function promptDeleteComponent(
  itemType,
  itemName,
  commentCount = 0,
) {
  return confirm({
    title: <UiText message={"Confirm deletion"} />,
    confirmLabel: translate(getUiLocale(), "Delete"),
    message: (
      <>
        <UiText
          message="Are you sure you want to delete {type} {name}?"
          values={{
            type: translateUiLabel(getUiLocale(), itemType),
            name: itemName,
          }}
        />
        {commentCount > 0 && (
          <>
            {" "}
            <UiText
              message={
                commentCount === 1
                  ? "It currently contains {count} unresolved comment."
                  : "It currently contains {count} unresolved comments."
              }
              values={{ count: commentCount }}
            />
          </>
        )}
      </>
    ),
  });
}
