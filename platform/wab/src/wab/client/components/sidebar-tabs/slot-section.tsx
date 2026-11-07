import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { FullRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  ExpsProvider,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import StyleSwitch from "@/wab/client/components/style-controls/StyleSwitch";
import LabeledListItem from "@/wab/client/components/widgets/LabeledListItem";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { spawn } from "@/wab/shared/common";
import { isTplSlot } from "@/wab/shared/core/tpls";
import { Tooltip } from "antd";
import React from "react";
import { useStore } from "zustand";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { TplSlot } from "@/wab/shared/model/classes";

export function SlotSettingsSection(props: { expsProvider: ExpsProvider }) {
  const { expsProvider } = props;
  if (!(expsProvider instanceof TplExpsProvider) || !isTplSlot(expsProvider.tpl)) {
    return null;
  }
  return <SlotSettingsBody tpl={expsProvider.tpl} studioCtx={expsProvider.studioCtx} />;
}

function SlotSettingsBody({ tpl, studioCtx }: { tpl: TplSlot; studioCtx: StudioCtx }) {
  const { t: uiT } = useI18n();
  const models = studioCtx.modelSnapshots;
  const paramRef = useStore(models.field(tpl, "param"));
  const param = models.resolve(paramRef);
  const mergeWithParent = useStore(models.field(param, "mergeWithParent"));
    return (
      <SidebarSection
        fullyCollapsible
        title={uiT("Advanced settings")}
        hasExtraContent
      >
        {(renderMaybeCollapsibleRows) =>
          renderMaybeCollapsibleRows([
            {
              collapsible: !mergeWithParent,
              content: (
                <FullRow>
                  <LabeledListItem
                    indicator={mergeWithParent}
                    padding={["noHorizontal"]}
                    noLabel
                  >
                    <StyleSwitch
                      isChecked={mergeWithParent}
                      onChange={(val) => {
                        spawn(
                          studioCtx.changeUnsafe(() => {
                            param.mergeWithParent = val;
                          }),
                        );
                      }}
                    >
                      <Tooltip
                        title={uiT(
                          "Merge slot contents with the component; Studio users need to select the component first before they can select contents from this slot",
                        )}
                      >
                        <span>
                          <UiText message={"Merge with component"} />
                        </span>
                      </Tooltip>
                    </StyleSwitch>
                  </LabeledListItem>
                </FullRow>
              ),
            },
          ])
        }
      </SidebarSection>
    );
}
