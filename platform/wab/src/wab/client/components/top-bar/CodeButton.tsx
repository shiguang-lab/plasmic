import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import { useTopFrameApi } from "@/wab/client/contexts/AppContexts";
import { useCodegenType } from "@/wab/client/hooks/useCodegenType";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import CirclesvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__CircleSvg";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { toClassName } from "@/wab/shared/codegen/util";
import { spawn } from "@/wab/shared/common";
import { isPlasmicComponent } from "@/wab/shared/core/components";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { PlasmicIcon } from "@plasmicapp/react-web";
import { Button, Menu, Tooltip } from "antd";
import { defer } from "lodash";
import { observer } from "mobx-react";
import * as React from "react";
import { MdOpenInNew } from "react-icons/all";
import { useLocalStorage } from "react-use";

export const CodeButton = observer(function CodeButton({
  showOptions = true,
}: {
  showOptions?: boolean;
}) {
  const { t: uiT } = useI18n();
  const studioCtx = useStudioCtx();
  const topFrameApi = useTopFrameApi();

  const artboardComponent = studioCtx.focusedViewCtx()?.component;
  const isFocusedComponentPlasmicComponent = !!(
    artboardComponent && isPlasmicComponent(artboardComponent)
  );
  const focusedComponentNameOrUuid = isFocusedComponentPlasmicComponent
    ? toClassName(artboardComponent!.name) || artboardComponent!.uuid
    : undefined;

  const anchorRef = React.useRef<HTMLDivElement>(null);

  const [hasClicked, setHasClicked] = useLocalStorage(
    "CodeButton--hasClicked",
    false,
  );

  const codegenType = useCodegenType();
  const toUrl =
    hasClicked &&
    isFocusedComponentPlasmicComponent &&
    focusedComponentNameOrUuid
      ? APP_ROUTES.projectDocsComponent.fill({
          projectId: studioCtx.siteInfo.id,
          componentIdOrClassName: focusedComponentNameOrUuid,
          codegenType,
        })
      : APP_ROUTES.projectDocs.fill({
          projectId: studioCtx.siteInfo.id,
        });

  // Quick and dirty way of disabling the red dot on Plasmic Levels.
  const isPlasmicLevels = studioCtx.siteInfo.name.includes("Plasmic Levels");
  const projectWasNeverSyncedOrImported =
    studioCtx.siteInfo.latestRevisionSynced === 0;
  const redCircle = !isPlasmicLevels && projectWasNeverSyncedOrImported;

  function showQuickstarts() {
    if (!isPlasmicLevels) {
      spawn(topFrameApi.setShowCodeModal(true));
      defer(() => setHasClicked(true));
    }
  }

  const quickstartTooltipContent = isPlasmicLevels ? (
    uiT("Disabled for Plasmic Levels")
  ) : (
    <>
      <UiText message={"Integrate into your codebase"} />
      {redCircle && (
        <div className="mt-sm">
          <UiText
            message={
              "(This project has never been synced and never been imported.)"
            }
          />
        </div>
      )}
    </>
  );
  return (
    <>
      <div className="editor-code-controls" ref={anchorRef}>
        <Tooltip
          trigger={["hover", "focus"]}
          title={
            <>
              {uiT("Code")}
              <div>{quickstartTooltipContent}</div>
            </>
          }
        >
          <Button
            type="text"
            className="editor-icon-action"
            aria-label={uiT("Code")}
            disabled={isPlasmicLevels}
            onClick={showQuickstarts}
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18" />
              </svg>
            }
          />
        </Tooltip>
        {showOptions && (
          <IFrameAwareDropdownMenu
            menu={() => (
              <Menu>
                <Menu.Item
                  onClick={() => showQuickstarts()}
                  disabled={isPlasmicLevels}
                >
                  <Tooltip title={quickstartTooltipContent}>
                    <UiText message={"Quickstarts"} />
                  </Tooltip>
                </Menu.Item>
                <Menu.Item
                  onClick={() => window.open("https://docs.plasmic.app/learn")}
                >
                  <UiText message={"Documentation"} />
                  <MdOpenInNew style={{ color: "silver", marginLeft: "8px" }} />
                </Menu.Item>
                <Menu.Item
                  disabled={isPlasmicLevels}
                  onClick={() => {
                    window.open(toUrl);
                  }}
                >
                  <Tooltip
                    title={
                      isPlasmicLevels
                        ? uiT("Disabled for Plasmic Levels")
                        : uiT(
                            "Auto-generated docs and component explorer for this project",
                          )
                    }
                  >
                    <UiText message={"Component API explorer"} />
                    <MdOpenInNew
                      style={{ color: "silver", marginLeft: "8px" }}
                    />
                  </Tooltip>
                </Menu.Item>
                <Menu.Item
                  onClick={() =>
                    window.open("https://www.github.com/plasmicapp/plasmic")
                  }
                >
                  <UiText message={"Plasmic on GitHub"} />
                  <MdOpenInNew style={{ color: "silver", marginLeft: "8px" }} />
                </Menu.Item>
              </Menu>
            )}
          >
            <Button
              className="editor-code-options"
              type="text"
              aria-label={uiT("Code options")}
              icon={
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              }
            />
          </IFrameAwareDropdownMenu>
        )}
      </div>
      {redCircle ? (
        <PlasmicIcon
          PlasmicIconType={CirclesvgIcon}
          className={"red-circle-top-right"}
          role={"img"}
        />
      ) : null}
    </>
  );
});

export default CodeButton;
