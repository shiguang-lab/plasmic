import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { reactPrompt } from "@/wab/client/components/quick-modals";
import { Matcher } from "@/wab/client/components/view-common";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";

import { VERT_MENU_ICON } from "@/wab/client/icons";
import PlasmicLeftFontsPanel from "@/wab/client/plasmic/plasmic_kit/PlasmicLeftFontsPanel";
import AlertIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WarningTriangleSvg";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { swallowClick } from "@/wab/commons/components/ReactUtil";
import { arrayRemove } from "@/wab/shared/collections";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Menu, Tooltip, notification } from "antd";
import * as _ from "lodash";
import { observer } from "mobx-react";
import React from "react";

const helpSuffix =
  "[Learn how to add custom fonts](https://docs.plasmic.app/learn/custom-fonts).";

function _UserManagedFontsPanel(props: {}) {
  const { t: uiT } = useI18n();
  const sc = useStudioCtx();
  const missingUsedFonts = sc.fontManager.missingUsedFonts();
  const [query, setQuery] = React.useState("");
  const matcher = new Matcher(query);
  const readOnly = sc.getLeftTabPermission("fonts") === "readable";
  const renderFonts = () => {
    const fonts = sc.site.userManagedFonts.filter((font) =>
      matcher.matches(font),
    );

    const importedFonts = _.uniq(
      sc.site.projectDependencies.flatMap((p) => p.site.userManagedFonts),
    ).filter((font) => matcher.matches(font) && !fonts.includes(font));

    const makeOverlay = (font: string) => {
      const builder = new MenuBuilder();
      if (!readOnly) {
        builder.genSection(undefined, (push) => {
          push(
            <Menu.Item
              key="delete"
              onClick={async () =>
                sc.changeUnsafe(() => {
                  arrayRemove(sc.site.userManagedFonts, font);
                })
              }
            >
              <UiText message={"Delete"} />
            </Menu.Item>,
          );
        });
      }
      return builder.build({
        onMenuClick: (e) => e.domEvent.stopPropagation(),
        menuName: "custom-font-item-menu",
      });
    };

    const renderFont = (font: string, imported: boolean) => (
      <div className={"SidebarSectionListItem hover-outline"} key={font}>
        <div className={"flex-fill"}>
          <label style={{ marginRight: 3 }}>{font}</label>
          {!sc.fontManager.isUserManagedFontInstalled(font) && (
            <Tooltip
              title={uiT("This font is not available on this computer.")}
            >
              <Icon icon={AlertIcon} />
            </Tooltip>
          )}
        </div>

        {!imported ? (
          <IFrameAwareDropdownMenu menu={makeOverlay(font)}>
            <div
              className="SidebarSectionListItem__actionIcon pointer"
              onClick={swallowClick}
            >
              {VERT_MENU_ICON}
            </div>
          </IFrameAwareDropdownMenu>
        ) : (
          <span style={{ fontSize: "85%", opacity: 0.5 }}>
            <UiText message={"(imported)"} />
          </span>
        )}
      </div>
    );

    return [
      ...fonts.map((font) => renderFont(font, false)),
      ...importedFonts.map((font) => renderFont(font, true)),
    ];
  };

  const addFontFamily = async () => {
    const newFont = await reactPrompt({
      message: uiT(
        "Enter the font-family to use. Plasmic will allow you to use this font in design even if this font is not installed locally.",
      ),
      actionText: uiT("Add"),
      placeholder: uiT("Font family..."),
      defaultValue: undefined,
    });

    if (!newFont) {
      return;
    }
    if (sc.site.userManagedFonts.find((f) => f === newFont)) {
      notification.warning({
        message: uiT("{part1} is already in the fonts list", {
          part1: newFont,
        }),
      });

      return;
    }
    await sc.changeUnsafe(() => {
      sc.site.userManagedFonts.push(newFont);
    });
    await sc.fontManager.addUserManagedFont(newFont);
  };

  const helpPrefix =
    missingUsedFonts.length > 0
      ? uiT(
          "The project may not render correctly since the following fonts are missing from your machine: {part1}",
          {
            part1: String(
              missingUsedFonts.map((font) => `- \`${font}\``).join("\n"),
            ),
          },
        )
      : "";

  return (
    <PlasmicLeftFontsPanel
      leftSearchPanel={{
        searchboxProps: {
          value: query,
          onChange: (e) => setQuery(e.target.value),
          autoFocus: true,
        },
      }}
      newFontButton={
        readOnly
          ? { render: () => null }
          : {
              onClick: () => addFontFamily(),
            }
      }
      fontsHeader={{
        description: (
          <StandardMarkdown className="flex-col">
            {helpPrefix + "\n\n" + uiT(helpSuffix)}
          </StandardMarkdown>
        ),
      }}
      content={
        <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
          {renderFonts()}
        </Scrollbar>
      }
    />
  );
}

export const UserManagedFontsPanel = observer(_UserManagedFontsPanel);
