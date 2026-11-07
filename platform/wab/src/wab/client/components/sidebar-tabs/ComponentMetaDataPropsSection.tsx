import { COMMANDS } from "@/wab/client/commands/command";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import promptForMetadata from "@/wab/client/components/modals/ComponentMetadataModal";
import { ComponentPropModal } from "@/wab/client/components/modals/ComponentPropModal";
import { BoolPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import Button from "@/wab/client/components/widgets/Button";
import { MetadataTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { VERT_MENU_ICON } from "@/wab/client/icons";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { DELETE_ACTION } from "@/wab/shared/Labels";
import { toVarName } from "@/wab/shared/codegen/util";
import { spawn } from "@/wab/shared/common";
import {
  addOrEditComponentMetadata,
  removeComponentMetadata,
} from "@/wab/shared/core/components";
import { Component } from "@/wab/shared/model/classes";
import { Menu, notification } from "antd";
import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export function ComponentMetaDataPropsSection(props: {
    studioCtx: StudioCtx;
    component: Component;
    justOneSection?: "variants" | "slots" | "meta";
  }) {
    const { t: uiT } = useI18n();
    const { studioCtx, component, justOneSection } = props;
    const [showNewParamModal, setShowNewParamModal] = React.useState(false);
    const hasMetadata = useStore(studioCtx.modelSnapshots.field(component, "metadata"), (metadata) => Object.keys(metadata).length > 0);
    const contentEditorMode = useStore(studioCtx.uiEnvironment.store, (state) => state.contentEditorMode);
    const editableByContentEditor = useStore(studioCtx.modelSnapshots.field(component, "editableByContentEditor"));
    const hiddenFromContentEditor = useStore(studioCtx.modelSnapshots.field(component, "hiddenFromContentEditor"));
    const defaultShown = justOneSection === undefined;
    const shown = {
      variants: defaultShown,
      slots: defaultShown,
      meta: defaultShown,
      keyValue: defaultShown,
    };
    if (justOneSection) {
      shown[justOneSection] = true;
    }
    return (
      <SidebarSection>
        <div className="vlist-gap-m">
          {!contentEditorMode ? (
            <>
              <div className="SidebarSectionListItem justify-between">
                <div className="labeled-item__label">
                  <UiText message={"Editable by content editors"} />
                </div>
                <BoolPropEditor
                  onChange={(val) => {
                    spawn(
                      COMMANDS.component.settings.setEditableByContentEditor.execute(
                        studioCtx,
                        { value: val },
                        { component },
                      ),
                    );
                  }}
                  value={editableByContentEditor}
                />
              </div>

              <div className="SidebarSectionListItem justify-between">
                <div className="labeled-item__label">
                  <UiText message={"Hidden from content editors"} />
                </div>
                <BoolPropEditor
                  onChange={(val) => {
                    spawn(
                      COMMANDS.component.settings.setHiddenFromContentEditor.execute(
                        studioCtx,
                        { value: val },
                        {
                          component,
                        },
                      ),
                    );
                  }}
                  value={hiddenFromContentEditor}
                />
              </div>
            </>
          ) : null}

          {hasMetadata && shown.keyValue && (
            <MetadataSection
              studioCtx={studioCtx}
              title={uiT("Key-value Metadata")}
              component={component}
            />
          )}
        </div>
        <Button
          className="spaced-above"
          onClick={async (e) => {
            e.stopPropagation();
            const metaKeyAndValue = await promptForMetadata(component);
            if (!metaKeyAndValue) {
              notification.error({
                message: translate(getUiLocale(), "Fill key and value"),
                description: (
                  <>
                    <UiText message={"You should fill both key and value."} />
                  </>
                ),
              });
              return;
            }
            const validKey = toVarName(metaKeyAndValue.key);
            if (metaKeyAndValue.key !== validKey) {
              notification.info({
                message: translate(getUiLocale(), "Key changed to be valid"),
                description: (
                  <>
                    <UiText
                      message="{part1} is not a valid key name; renamed to {part2} instead."
                      values={{
                        part1: <code>{metaKeyAndValue.key}</code>,
                        part2: <code>{validKey}</code>,
                      }}
                    />
                  </>
                ),
              });
              metaKeyAndValue.key = validKey;
            }
            await studioCtx.changeUnsafe(() => {
              if (metaKeyAndValue.key in component.metadata) {
                notification.error({
                  message: translate(getUiLocale(), "Existing key"),
                  description: (
                    <>
                      <UiText
                        message="{part1} is already a metadata key."
                        values={{ part1: <code>{metaKeyAndValue.key}</code> }}
                      />
                    </>
                  ),
                });
              } else {
                addOrEditComponentMetadata(
                  component,
                  metaKeyAndValue.key,
                  metaKeyAndValue.value,
                );
              }
            });
          }}
        >
          <LabelWithDetailedTooltip tooltip={MetadataTooltip}>
            <UiText message={"Add metadata key-value"} />
          </LabelWithDetailedTooltip>
        </Button>
        {showNewParamModal && (
          <ComponentPropModal
            studioCtx={studioCtx}
            component={component}
            visible={showNewParamModal}
            onFinish={() => setShowNewParamModal(false)}
          />
        )}
      </SidebarSection>
    );
  }

function MetadataSection(props: {
  studioCtx: StudioCtx;
  title: React.ReactNode;
  component: Component;
}) {
  const { studioCtx, component, title } = props;
  const metadataKeys = useStore(studioCtx.modelSnapshots.field(component, "metadata"), useShallow((metadata) => Object.keys(metadata)));
  return (
    <div>
      <div className="dimfg uppercase strong text-sm">{title}</div>
      <div className="vlist-gap-sm vlist-gray-border">
        {metadataKeys.map((key) => (
          <MetadataRow
            studioCtx={studioCtx}
            component={component}
            metadataKey={key}
            key={key}
          />
        ))}
      </div>
    </div>
  );
}

function MetadataRow(props: {
  studioCtx: StudioCtx;
  component: Component;
  metadataKey: string;
  children?: React.ReactNode;
}) {
  const { studioCtx, component, metadataKey } = props;
  const value = useStore(studioCtx.modelSnapshots.field(component, "metadata"), (metadata) => metadata[metadataKey]);
  const overlay = () => makeMetadataMenu(studioCtx, component, metadataKey);
  return (
    <div>
      <WithContextMenu
        className="SidebarSectionListItem group p0"
        overlay={overlay}
      >
        <EditableLabel
          value={metadataKey}
          onEdit={(newKey) => {
            const validKey = toVarName(newKey);
            if (newKey !== validKey) {
              notification.info({
                message: translate(getUiLocale(), "Key changed to be valid"),
                description: (
                  <>
                    <UiText
                      message="{part1} is not a valid key name; renamed to {part2} instead."
                      values={{
                        part1: <code>{newKey}</code>,
                        part2: <code>{validKey}</code>,
                      }}
                    />
                  </>
                ),
              });
              newKey = validKey;
            }
            spawn(
              studioCtx.changeUnsafe(() => {
                if (newKey !== metadataKey) {
                  if (newKey in component.metadata) {
                    notification.error({
                      message: translate(getUiLocale(), "Existing key"),
                      description: (
                        <>
                          <UiText
                            message="{part1} is already a metadata key."
                            values={{ part1: <code>{newKey}</code> }}
                          />
                        </>
                      ),
                    });
                  } else {
                    addOrEditComponentMetadata(
                      component,
                      newKey,
                      component.metadata[metadataKey],
                    );
                    removeComponentMetadata(component, metadataKey);
                  }
                }
              }),
            );
          }}
          labelFactory={(_props) => (
            <span {..._props} className="flex-fill mr-sm text-ellipsis code" />
          )}
          doubleClickToEdit
        />
        <EditableLabel
          value={value}
          onEdit={(newValue) => {
            spawn(
              studioCtx.changeUnsafe(() => {
                addOrEditComponentMetadata(component, metadataKey, newValue);
              }),
            );
          }}
          labelFactory={(_props) => (
            <span {..._props} className="flex-fill mr-sm text-ellipsis code" />
          )}
          doubleClickToEdit
        />
        <IFrameAwareDropdownMenu menu={overlay}>
          <div className="SidebarSectionListItem__actionIcon">
            {VERT_MENU_ICON}
          </div>
        </IFrameAwareDropdownMenu>
      </WithContextMenu>
    </div>
  );
}

function makeMetadataMenu(
  studioCtx: StudioCtx,
  component: Component,
  metadataKey: string,
) {
  return (
    <Menu>
      <Menu.Item
        onClick={() =>
          studioCtx.changeUnsafe(() => {
            removeComponentMetadata(component, metadataKey);
          })
        }
      >
        {<UiLabel text={DELETE_ACTION} />}
      </Menu.Item>
    </Menu>
  );
}
