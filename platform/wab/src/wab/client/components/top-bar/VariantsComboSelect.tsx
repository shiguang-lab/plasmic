import { useShallow } from "zustand/react/shallow";
import { usePreviewVariantModelInputs } from "@/wab/client/components/top-bar/preview-variant-inputs";
import { usePreviewCtx, usePreviewSelector } from "@/wab/client/components/live/PreviewCtx";
import VariantsMenu from "@/wab/client/components/top-bar/VariantsMenu";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultVariantsComboSelectProps,
  PlasmicVariantsComboSelect,
} from "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect";
import { Dropdown } from "antd";
import * as React from "react";

type VariantsComboSelectProps = DefaultVariantsComboSelectProps;

const VariantsComboSelect = React.memo(function VariantsComboSelect(
  props: VariantsComboSelectProps,
) {
  const studioCtx = useStudioCtx();
  const previewCtx = usePreviewCtx();
  const component = usePreviewSelector(previewCtx, (state) => state.previewData ? previewCtx.component : undefined);
  const activeVariants = usePreviewSelector(previewCtx, useShallow((state) => state.previewData ? previewCtx.getVariants() : []));
  const model = usePreviewVariantModelInputs(studioCtx, component);

  const [showDropdown, setShowDropdown] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useAutoFocus(showDropdown && inputRef);

  if (!component || !model.alive) {
    return null;
  }

  const activeVariantUuids = new Set(activeVariants.map((variant) => variant.uuid));
  const variantGroupsData = model.groups;

  return (
    <Dropdown
      transitionName=""
      trigger={["click"]}
      placement={"topLeft"}
      open={showDropdown}
      onOpenChange={(v) => {
        setIsOpen(v);
        setShowDropdown(v);
      }}
      popupRender={() => (
        <VariantsMenu
          onDismiss={() => {
            setIsOpen(false);
            setShowDropdown(false);
          }}
          searchInputRef={inputRef}
          targetedVariants={activeVariantUuids}
          variantGroupsData={variantGroupsData}
          previewCtx={previewCtx}
          studioCtx={studioCtx}
        />
      )}
    >
      {/* The generated component drops refs; TriggerTarget anchors the menu. */}
      <TriggerTarget>
        <PlasmicVariantsComboSelect isOpen={isOpen} {...props}>
          {activeVariants.length === 0 ? (
            <UiText message={"Base"} />
          ) : (
            activeVariants
              .map((variant) => model.labels[variant.uuid])
              .join(", ")
          )}
        </PlasmicVariantsComboSelect>
      </TriggerTarget>
    </Dropdown>
  );
});

export default VariantsComboSelect;
