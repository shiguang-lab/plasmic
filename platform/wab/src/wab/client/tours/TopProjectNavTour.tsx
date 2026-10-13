import { tourSeenTopProjectNavKey } from "@/wab/client/LocalStorageKey";
import { KeyboardShortcut } from "@/wab/client/components/menu-builder";
import { UiText } from "@/wab/client/i18n/UiText";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Tour } from "@/wab/client/tours/Tour";
import { observer } from "mobx-react";
import React from "react";

export const TopProjectNavTour = observer(function TopProjectNavTour() {
  const studioCtx = useStudioCtx();
  const seenStateKey = tourSeenTopProjectNavKey;
  const targetSelector = "#proj-nav-button";
  const onlyUsersCreatedBefore = "2022-11-01";
  const didActionSignal = studioCtx.showNavigationPanelRequested;
  const content = (
    <>
      <h4 className="text-xlg mb-p">
        <UiText message={"Project navigation has moved!"} />
      </h4>
      <p>
        {" "}
        <UiText
          message={
            "Use the Documents tab to navigate to your pages, components and arenas. You can also use the keyboard shortcut"
          }
        />{" "}
        <KeyboardShortcut>
          {getComboForAction("SEARCH_PROJECT_ARENAS")}
        </KeyboardShortcut>{" "}
        <UiText message={"to open document search."} />{" "}
      </p>
    </>
  );
  return (
    <Tour
      {...{
        seenStateKey: seenStateKey,
        onlyUsersCreatedBefore: onlyUsersCreatedBefore,
        didActionSignal: didActionSignal,
        targetSelector: targetSelector,
        content: content,
      }}
    />
  );
});
