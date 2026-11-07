import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import DimTokenSpinner from "@/wab/client/components/widgets/DimTokenSelector";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultIconTogglesPanelProps,
  PlasmicIconTogglesPanel,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicIconTogglesPanel";
import { useDocsFocusedIconRef } from "@/wab/client/components/docs/DocsModelResources";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { ImageAsset } from "@/wab/shared/model/classes";
import { LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";
import { useLocalStorage } from "react-use";
import { useStore } from "zustand";

type IconTogglesPanelProps = DefaultIconTogglesPanelProps;

function IconTogglesPanel(props: IconTogglesPanelProps) {
  const docsCtx = useDocsPortalCtx();
  const iconRef = useDocsFocusedIconRef(docsCtx);
  return iconRef ? <FocusedIconTogglesPanel {...props} docsCtx={docsCtx} iconRef={iconRef} /> : null;
}

function FocusedIconTogglesPanel({ docsCtx, iconRef, ...props }: IconTogglesPanelProps & { docsCtx: DocsPortalCtx; iconRef: ModelRef<ImageAsset> }) {
  const { t: uiT } = useI18n();
  const className = useStore(docsCtx.models.getIconModelStore(iconRef), (state) => state.className);
  const icon = docsCtx.models.snapshots.resolve(iconRef);
  const toggles = useStore(
    docsCtx.getIconStore(icon),
    (state) => state.toggles,
  );

  const [dismissed, setDismissed] = useLocalStorage(
    "IconTogglesPanel--dismissIconInfo",
    false,
  );

  return (
    <PlasmicIconTogglesPanel
      {...props}
      body={{
        as: Scrollbar,
        style: { overflow: "hidden" },
        props: { scrollX: false },
      }}
      explanation={{
        defaultExpanded: !dismissed,
        children: <IconTogglesInfo />,
        onToggle: (expanded) => {
          if (!expanded && !dismissed) {
            setDismissed(true);
          }
        },
      }}
      header={className}
      title={{
        children: (
          <Textbox
            styleType={"bordered"}
            value={toggles.get("title")}
            onChange={(e) =>
              docsCtx.setIconToggle(icon, "title", e.target.value || undefined)
            }
            placeholder={uiT("Unset")}
          />
        ),
      }}
      color={{
        primaryAnnotation: (
          <SidebarModalProvider>
            <ColorButton
              onChange={(val) => docsCtx.setIconToggle(icon, "color", val)}
              sc={docsCtx.studioCtx}
              color={toggles.get("color")}
            />
          </SidebarModalProvider>
        ),
      }}
      width={{
        children: (
          <DimTokenSpinner
            min={1}
            value={toggles.get("width") || ""}
            onChange={(v) => docsCtx.setIconToggle(icon, "width", v)}
            styleType={["bordered"]}
            placeholder={uiT("Unset")}
            allowedUnits={LENGTH_PERCENTAGE_UNITS}
            allowFunctions
          />
        ),
      }}
      height={{
        children: (
          <DimTokenSpinner
            min={1}
            value={toggles.get("height") || ""}
            onChange={(v) => docsCtx.setIconToggle(icon, "height", v)}
            styleType={["bordered"]}
            placeholder={uiT("Unset")}
            allowedUnits={LENGTH_PERCENTAGE_UNITS}
            allowFunctions
          />
        ),
      }}
      resetButton={{
        onClick: () => docsCtx.resetIconToggles(icon),
      }}
    />
  );
}

export default IconTogglesPanel;

function IconTogglesInfo() {
  return (
    <div>
      {" "}
      <UiText
        message={
          "Each SVG icon added to Plasmic can be used as a React component. Each component takes in the usual props you can pass into an"
        }
      />{" "}
      <code>svg</code> <UiText message={"element. By default, its size is"} />{" "}
      <code>1em</code>.
    </div>
  );
}
