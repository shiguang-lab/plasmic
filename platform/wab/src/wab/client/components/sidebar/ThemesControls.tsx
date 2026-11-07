import { useThemeSelection } from "@/wab/client/components/sidebar/theme-selection-state";
import { UiText } from "@/wab/client/i18n/UiText";
import { useI18n } from "@/wab/client/i18n";
import PlasmicLeftThemesPanel from "@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftThemesPanel";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import React from "react";

export const DefaultStylesPanel = function DefaultStylesPanel() {
  const { t } = useI18n();
  const studioCtx = useStudioCtx();
  const { selection, activate } = useThemeSelection(studioCtx, (state) => state);
  const options = selection.options.map((option) => ({
    value: option.value,
    label:
      option.ownerProjectName === undefined
        ? t("This project's theme")
        : t("Theme from {project}", { project: option.ownerProjectName }),
  }));

  return (
    <PlasmicLeftThemesPanel
      noThemePicker={options.length <= 1}
      hiliteTabs={{
        tabs: [
          { tabKey: "styles", content: <UiText message="Typography" /> },
          { tabKey: "layout", content: <UiText message="Layout" /> },
          { tabKey: "initials", content: <UiText message="Initial styles" /> },
        ],
      }}
      themeSelector={{
        props: {
          options,
          value: selection.activeThemeValue,
          onChange: async (newVal) => {
            const option = selection.options.find(
              (candidate) => candidate.value === newVal,
            );
            if (option) {
              await activate(option.ref);
            }
          },
        },
      }}
      notOwnedBySite={selection.notOwnedBySite}
    />
  );
};

export default DefaultStylesPanel;
