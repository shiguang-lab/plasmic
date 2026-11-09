import { useComponentParamValue } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useLibraryAppInputs } from "@/wab/client/components/sidebar/library-inputs";
import { COMMANDS } from "@/wab/client/commands/command";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import promptForMetadata from "@/wab/client/components/modals/ComponentMetadataModal";
import { ComponentPropModal } from "@/wab/client/components/modals/ComponentPropModal";
import { BoolPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor";
import { updateOrCreateExpr } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { PropValueEditor } from "@/wab/client/components/sidebar-tabs/PropValueEditor";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import Button from "@/wab/client/components/widgets/Button";
import {
  MetadataTooltip,
  PropsTooltip,
} from "@/wab/client/components/widgets/DetailedTooltips";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import LabeledListItem from "@/wab/client/components/widgets/LabeledListItem";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { VERT_MENU_ICON } from "@/wab/client/icons";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getSlotParams } from "@/wab/shared/SlotUtils";
import { wabTypeToPropType } from "@/wab/shared/code-components/code-components";
import { toVarName } from "@/wab/shared/codegen/util";
import { spawn } from "@/wab/shared/common";
import {
  addOrEditComponentMetadata,
  canDeleteParam,
  canRenameParam,
  getRealParams,
  isCodeComponent,
  isReusableComponent,
  removeComponentMetadata,
  removeComponentParam,
} from "@/wab/shared/core/components";
import { extractLit } from "@/wab/shared/core/states";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import {
  Component,
  ComponentTemplateInfo,
  Param,
  isKnownFunctionType,
} from "@/wab/shared/model/classes";
import { typeDisplayName } from "@/wab/shared/model/model-util";
import { Menu, Tooltip, notification } from "antd";
import { ok } from "neverthrow";
import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface LegacyComponentParamsProps { studioCtx: StudioCtx; component: Component; metaDataOnly?: boolean; justOneSection?: "variants" | "slots" | "meta"; }
export const LegacyComponentParamsSection = React.memo(function LegacyComponentParamsSection(props: LegacyComponentParamsProps) {
  const world = useVariantModelWorld(props.studioCtx, props.component);
  return world.alive ? <LegacyComponentParamsContent {...props} /> : null;
});
const LegacyComponentParamsContent = React.memo(function LegacyComponentParamsContent(props: LegacyComponentParamsProps) {
    const { t: uiT } = useI18n();
    const { studioCtx, component, justOneSection, metaDataOnly } = props;
    const selectParams = React.useCallback(() => Object.freeze({
      slots: getSlotParams(component), real: getRealParams(component),
      variants: component.variantGroups.map((group) => group.param),
      reusable: isReusableComponent(component), trapsFocus: component.trapsFocus,
    }), [component]);
    const parameterInputs = useComponentParamValue(studioCtx, component, selectParams);
    useLibraryAppInputs(studioCtx);
    const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);
    const [showNewParamModal, setShowNewParamModal] = React.useState(false);

    const { slots: slotParams, real: realParams } = parameterInputs;
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
              <div className="flex flex-vcenter justify-between list-item-height">
                <div className="labeled-item__label">
                  <UiText message={"Editable by content editors"} />
                </div>
                <BoolPropEditor
                  onChange={(val) => {
                    if (!world.isCurrent()) { return; }
                    spawn(
                      COMMANDS.component.settings.setEditableByContentEditor.execute(
                        studioCtx,
                        { value: val },
                        {
                          component,
                        },
                      ),
                    );
                  }}
                  value={editableByContentEditor}
                />
              </div>

              <div className="flex flex-vcenter justify-between list-item-height">
                <div className="labeled-item__label">
                  <UiText message={"Hidden from content editors"} />
                </div>
                <BoolPropEditor
                  onChange={(val) => {
                    if (!world.isCurrent()) { return; }
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

          {parameterInputs.reusable && (
            <div className="flex flex-vcenter justify-between list-item-height">
              <div className="labeled-item__label">
                <LabelWithDetailedTooltip
                  tooltip={() =>
                    "User of the studio must select this component element first before selecting any of its slot contents. Useful for components like Button, where the user is much more likely to intend to select the Button itself than its label."
                  }
                >
                  <UiText message={"Selected before slot contents"} />
                </LabelWithDetailedTooltip>
              </div>
              <BoolPropEditor
                onChange={(val) => {
                  if (!world.isCurrent()) { return; }
                  spawn(
                    COMMANDS.component.settings.setTrapFocus.execute(
                      studioCtx,
                      { value: val },
                      {
                        component,
                      },
                    ),
                  );
                }}
                value={parameterInputs.trapsFocus}
              />
            </div>
          )}

          {!metaDataOnly &&
            parameterInputs.variants.length > 0 &&
            shown.variants && (
              <ParamsSection
                title={uiT("Variants")}
                studioCtx={studioCtx}
                component={component}
                params={parameterInputs.variants}
              />
            )}
          {!metaDataOnly && slotParams.length > 0 && shown.slots && (
            <ParamsSection
              title={uiT("Slots")}
              studioCtx={studioCtx}
              component={component}
              params={slotParams}
            />
          )}
          {hasMetadata && shown.keyValue && (
            <MetadataSection
              studioCtx={studioCtx}
              title={uiT("Key-value Metadata")}
              component={component}
            />
          )}
          {!metaDataOnly && realParams.length > 0 && shown.meta && (
            <ParamsSection
              title={justOneSection === "meta" ? "" : uiT("Others")}
              studioCtx={studioCtx}
              component={component}
              params={realParams}
              showType={true}
              showDefault={true}
            />
          )}
        </div>
        <Button
          className="spaced-above"
          onClick={async (e) => {
            e.stopPropagation();
            if (!world.isCurrent()) { return; }
            const metaKeyAndValue = await promptForMetadata(component);
            if (!world.isCurrent()) { return; }
            if (!metaKeyAndValue) {
              notification.error({
                message: uiT("Fill key and value"),
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
                message: uiT("Key changed to be valid"),
                description: (
                  <>
                    <UiText
                      message={
                        "{part1} is not a valid key name; renamed to {part2} instead."
                      }
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
              if (!world.isCurrent()) { return; }
              if (metaKeyAndValue.key in component.metadata) {
                notification.error({
                  message: uiT("Existing key"),
                  description: (
                    <>
                      <UiText
                        message={"{part1} is already a metadata key."}
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
        {!metaDataOnly && (
          <Button
            className="spaced-above"
            onClick={() => setShowNewParamModal(true)}
          >
            <LabelWithDetailedTooltip tooltip={PropsTooltip}>
              <UiText message={"Create prop"} />
            </LabelWithDetailedTooltip>
          </Button>
        )}
        {isAdminTeamEmail(
          studioCtx.appCtx.selfInfo?.email,
          studioCtx.appCtx.appConfig,
        ) && (
          <LabeledListItem
            className="mt-m p0"
            label={
              <Tooltip
                title={uiT("Globally unique name for this template component")}
              >
                <span>
                  <UiText message={"Template component name"} />
                </span>
              </Tooltip>
            }
          >
            <Textbox
              styleType="gray"
              defaultValue={component.templateInfo?.name ?? ""}
              onEdit={(value) => {
                spawn(
                  studioCtx.changeUnsafe(() => {
              if (!world.isCurrent()) { return; }
                    if (value.trim() === "") {
                      component.templateInfo = null;
                    } else if (component.templateInfo) {
                      component.templateInfo.name = value;
                    } else {
                      component.templateInfo = new ComponentTemplateInfo({
                        name: value,
                        projectId: undefined,
                        componentId: undefined,
                      });
                    }
                  }),
                );
              }}
            />
          </LabeledListItem>
        )}
        {showNewParamModal && (
          <ComponentPropModal
            studioCtx={studioCtx}
            component={component}
            visible={showNewParamModal}
            centeredModal={true}
            onFinish={() => setShowNewParamModal(false)}
          />
        )}
      </SidebarSection>
    );
  }
);

function ParamsSection(props: {
  title: React.ReactNode;
  studioCtx: StudioCtx;
  component: Component;
  params: Param[];
  showType?: boolean;
  showDefault?: boolean;
}) {
  const { studioCtx, component, params, showType, showDefault, title } = props;
  return (
    <div>
      <div className="dimfg uppercase strong text-sm">{title}</div>
      <div className="vlist-gap-sm vlist-gray-border">
        {params.map((param) => (
          <ParamRow
            studioCtx={studioCtx}
            component={component}
            param={param}
            showType={showType}
            showDefault={showDefault}
          />
        ))}
      </div>
    </div>
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

const ParamRow = React.memo(function ParamRow(props: {
  studioCtx: StudioCtx;
  component: Component;
  param: Param;
  children?: React.ReactNode;
  showType?: boolean;
  showDefault?: boolean;
}) {
  const { studioCtx, component, param, showType, showDefault } = props;
  const selectRow = React.useCallback(() => Object.freeze({
    name: param.variable.name, type: typeDisplayName(param.type), canRename: canRenameParam(component, param),
    isFunction: isKnownFunctionType(param.type), propType: wabTypeToPropType(param.type), defaultValue: extractLit(param),
  }), [component, param]);
  const row = useComponentParamValue(studioCtx, component, selectRow, param);
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);

  const defaultLit = row.defaultValue;

  const overlay = () => world.isCurrent() ? makeParamMenu(studioCtx, component, param) : <></>;
  return (
    <div>
      <WithContextMenu
        className="SidebarSectionListItem group p0"
        overlay={overlay}
      >
        <EditableLabel
          value={row.name}
          onEdit={(val) => {
            spawn(
              studioCtx.changeUnsafe(() =>
                world.isCurrent() &&
                studioCtx.tplMgr().renameParam(component, param, val),
              ),
            );
          }}
          labelFactory={(_props) => (
            <span {..._props} className="flex-fill mr-sm text-ellipsis code" />
          )}
          doubleClickToEdit
          disabled={!row.canRename}
        />
        {showType && (
          <div className="dimfg">
            <UiText message={"(Type:"} /> {row.type})
          </div>
        )}
        <IFrameAwareDropdownMenu menu={overlay}>
          <div className="SidebarSectionListItem__actionIcon">
            {VERT_MENU_ICON}
          </div>
        </IFrameAwareDropdownMenu>
      </WithContextMenu>
      {showDefault && !row.isFunction && (
        <div className="flex flex-vcenter list-item-height">
          <LabeledItemRow
            label={
              <div className="dimfg">
                <UiText message={"Default:"} />
              </div>
            }
            labelSize="small"
          >
            <PropValueEditor
              attr={row.name}
              label={row.name}
              propType={row.propType}
              value={defaultLit}
              disabled={false}
              onChange={(val) => {
                if (defaultLit === undefined && val === undefined) {
                  return;
                }

                spawn(
                  studioCtx.change(() => {
                    if (!world.isCurrent()) { return ok(); }
                    param.defaultExpr = updateOrCreateExpr(
                      param.defaultExpr,
                      param.type,
                      val,
                      undefined,
                      undefined,
                    );
                    return ok();
                  }),
                );
              }}
            />
          </LabeledItemRow>
        </div>
      )}
    </div>
  );
});

function MetadataRow(props: {
  studioCtx: StudioCtx;
  component: Component;
  metadataKey: string;
  children?: React.ReactNode;
}) {
  const { t: studioUiT } = useI18n();

  const { studioCtx, component, metadataKey } = props;
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, component]);
  const value = useStore(studioCtx.modelSnapshots.field(component, "metadata"), (metadata) => metadata[metadataKey]);
  const overlay = () => world.isCurrent() ? makeMetadataMenu(studioCtx, component, metadataKey) : <></>;
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
                message: studioUiT("Key changed to be valid"),
                description: (
                  <>
                    <UiText
                      message={
                        "{part1} is not a valid key name; renamed to {part2} instead."
                      }
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
              if (!world.isCurrent()) { return; }
                if (newKey !== metadataKey) {
                  if (newKey in component.metadata) {
                    notification.error({
                      message: studioUiT("Existing key"),
                      description: (
                        <>
                          <UiText
                            message={"{part1} is already a metadata key."}
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
              if (!world.isCurrent()) { return; }
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

function makeParamMenu(
  studioCtx: StudioCtx,
  component: Component,
  param: Param,
) {
  const world = captureVariantModelWorld(studioCtx);
  return (
    <Menu>
      {/*<Menu.SubMenu title="Set code export type to">*/}
      {/*  {[*/}
      {/*    ParamExportType.External,*/}
      {/*    ParamExportType.Internal,*/}
      {/*    ParamExportType.ToolsOnly,*/}
      {/*  ].map((exportType) => (*/}
      {/*    <Menu.Item*/}
      {/*      key={exportType}*/}
      {/*      onClick={() =>*/}
      {/*        studioCtx.changeUnsafe(() => (param.exportType = exportType))*/}
      {/*      }*/}
      {/*    >*/}
      {/*      {exportType} {param.exportType === exportType ? <FaCheck /> : null}*/}
      {/*    </Menu.Item>*/}
      {/*  ))}*/}
      {/*</Menu.SubMenu>*/}
      {!isCodeComponent(component) && canDeleteParam(component, param) && (
        <Menu.Item
          onClick={() =>
            studioCtx.changeUnsafe(() => {
              if (!world.isCurrent()) { return; }
              removeComponentParam(studioCtx.site, component, param);
            })
          }
        >
          <UiText message={"Delete prop"} />
        </Menu.Item>
      )}
    </Menu>
  );
}

function makeMetadataMenu(
  studioCtx: StudioCtx,
  component: Component,
  metadataKey: string,
) {
  const world = captureVariantModelWorld(studioCtx);
  return (
    <Menu>
      <Menu.Item
        onClick={() =>
          studioCtx.changeUnsafe(() => {
              if (!world.isCurrent()) { return; }
            removeComponentMetadata(component, metadataKey);
          })
        }
      >
        <UiText message={"Delete metadata"} />
      </Menu.Item>
    </Menu>
  );
}
