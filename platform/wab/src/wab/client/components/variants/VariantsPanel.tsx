import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import { useVariantPanelInputs } from "@/wab/client/components/variants/variant-panel-inputs";
import { usePreviewVariantModelInputs } from "@/wab/client/components/top-bar/preview-variant-inputs";
import { usePropExpressionInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/prop-expression-inputs";
import { useModelRevisions } from "@/wab/client/stores/model-revisions-react";
import { modelKeys } from "@/wab/shared/model-revisions";
import { useVariantsController } from "@/wab/client/studio-ctx/variant-controller-inputs";
import {
  StyleOrCodeComponentVariantLabel,
  VariantLabel,
} from "@/wab/client/components/VariantControls";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { notifyLinkedPropDrift } from "@/wab/client/components/sidebar-tabs/linked-prop-utils";
import {
  SidebarSection,
  SidebarSectionHandle,
} from "@/wab/client/components/sidebar/SidebarSection";
import { EditableGroupLabel } from "@/wab/client/components/variants/EditableGroupLabel";
import { StandaloneVariant } from "@/wab/client/components/variants/StandaloneVariantGroup";
import { SuperComponentVariantsSection } from "@/wab/client/components/variants/SuperComponentVariantsSection";
import VariantComboRow from "@/wab/client/components/variants/VariantComboRow";
import VariantRow from "@/wab/client/components/variants/VariantRow";
import VariantSection, {
  makeReadOnlySection,
} from "@/wab/client/components/variants/VariantSection";
import {
  ComponentArenaVariantsController,
  CustomVariantsController,
  PageArenaVariantsController,
} from "@/wab/client/components/variants/VariantsController";
import {
  VariantDataPicker,
  makeVariantGroupMenu,
  makeVariantMenu,
} from "@/wab/client/components/variants/variant-menu";
import { IFrameAwareDropdownMenu } from "@/wab/client/components/widgets";
import {
  GlobalVariantsTooltip,
  VariantCombosTooltip,
  VariantsTooltip,
} from "@/wab/client/components/widgets/DetailedTooltips";
import { EditableLabelHandles } from "@/wab/client/components/widgets/EditableLabel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { SimpleReorderableList } from "@/wab/client/components/widgets/SimpleReorderableList";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import BoltIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Bolt";
import GlobeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Globe";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import VariantGroupIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__VariantGroup";
import ScreenIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Screen";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useModelUiActionHandler } from "@/wab/client/studio-ctx/ui/studio-ui-actions";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { testIds } from "@/wab/client/test-ids";
import { VariantPinState } from "@/wab/shared/PinManager";
import { VariantOptionsType } from "@/wab/shared/TplMgr";
import {
  StyleOrCodeComponentVariant,
  canHaveStyleOrCodeComponentVariant,
  getBaseVariant,
  isBaseVariant,
  isGlobalVariantGroup,
  isScreenVariantGroup,
  isStandaloneVariantGroup,
  moveVariant,
  moveVariantGroup,
  variantComboKey,
} from "@/wab/shared/Variants";
import { findNonEmptyCombos } from "@/wab/shared/cached-selectors";
import { isTplRootWithCodeComponentVariants } from "@/wab/shared/code-components/variants";
import { ensure, ensureInstance, partitions, spawn } from "@/wab/shared/common";
import {
  allComponentStyleOrCodeComponentVariants,
  getSuperComponents,
  isPageComponent,
} from "@/wab/shared/core/components";
import { tryGetGlobalVariantByUuid } from "@/wab/shared/core/sites";
import {
  isGlobalVariantGroupUsedInSplits,
  isVariantUsedInSplits,
} from "@/wab/shared/core/splits";
import { isTplCodeComponent } from "@/wab/shared/core/tpls";
import { ScreenSizeSpec } from "@/wab/shared/css-size";
import {
  Component,
  ComponentVariantGroup,
  ObjectPath,
  ProjectDependency,
  TplComponent,
  TplTag,
  Variant,
  VariantGroup,
  isKnownTplTag,
} from "@/wab/shared/model/classes";
import { getPlumeVariantDef } from "@/wab/shared/plume/plume-registry";
import { Button, Menu, Tooltip } from "antd";
import sortBy from "lodash/sortBy";
import { ok } from "neverthrow";
import * as React from "react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useSessionStorage } from "react-use";

interface VariantsPanelProps {
  studioCtx: StudioCtx;
  component: Component;
  viewCtx: ViewCtx;
}

export interface VariantsPanelHandle {
  onVariantAdded: (variant: Variant) => void;
  onVariantGroupAdded: (group: VariantGroup) => void;
}

export const VariantsPanel = React.memo(React.forwardRef(function VariantsPanel(props: VariantsPanelProps, ref: React.Ref<VariantsPanelHandle>) {
  const world = useVariantModelWorld(props.studioCtx, props.component, props.viewCtx);
  return world.alive ? <VariantsPanelContent {...props} ref={ref} /> : null;
}));
const VariantsPanelContent = React.memo(
  React.forwardRef(function VariantsPanel_(
    props: VariantsPanelProps,
    ref: React.Ref<VariantsPanelHandle>,
  ) {
    const { t: uiT } = useI18n();
    const { studioCtx, component, viewCtx } = props;
    const site = studioCtx.site;
    const world = useVariantModelWorld(studioCtx, component, viewCtx);
    usePreviewVariantModelInputs(studioCtx, component); useVariantPanelInputs(studioCtx, component);
    useVariantLabelInputs(studioCtx, component.variants, { component, componentVariants: true });
    // Finding nonempty combinations scans every variant setting in this component.
    useModelRevisions(studioCtx.modelRevisions, [modelKeys.component(component.uuid)]);

    const [justAddedGroup, setJustAddedGroup] = React.useState<
      VariantGroup | undefined
    >();

    const [justAddedVariant, setJustAddedVariant] = React.useState<
      Variant | undefined
    >();

    const projectId = studioCtx.siteInfo.id;
    const [expandGlobals, setExpandGlobals] = useSessionStorage(
      `expandGlobalVariants-${projectId}`,
      true,
    );

    const variantInput = useVariantsController(studioCtx, viewCtx);
    const vcontroller = variantInput?.commands;

    React.useImperativeHandle(ref, () => ({
      onVariantAdded: (variant: Variant) => {
        if (world.isCurrent()) { setJustAddedVariant(variant); }
      },
      onVariantGroupAdded: (group: VariantGroup) => {
        if (world.isCurrent()) { setJustAddedGroup(group); }
      },
    }));

    const globalVariantsSectionRef = React.useRef<SidebarSectionHandle>(null);

    useModelUiActionHandler("Variant", (uuid) => {
      if (
        world.isCurrent() && tryGetGlobalVariantByUuid(studioCtx.site, uuid, {
          includeDeps: "direct",
        })
      ) {
        globalVariantsSectionRef.current?.expand();
      }
    });

    const addVariantsMenu = new MenuBuilder()
          .genSection(undefined, (push) => {
            push(
              <Menu.Item
                key="toggle-group"
                onClick={() => addVariantGroup(VariantOptionsType.standalone)}
              >
                <UiText message={"Add"} />{" "}
                <strong>
                  <UiText message={"toggle"} />
                </strong>{" "}
                <UiText message={"variant"} />
              </Menu.Item>,
            );
            push(<Menu.Divider />);

            push(
              <Menu.Item
                key="single-select-group"
                onClick={() => addVariantGroup(VariantOptionsType.singleChoice)}
              >
                <UiText message={"Add"} />{" "}
                <strong>
                  <UiText message={"single-select"} />
                </strong>{" "}
                <UiText message={"group of variants"} />
              </Menu.Item>,
            );
            push(
              <Menu.Item
                key="multi-select-group"
                onClick={() => addVariantGroup(VariantOptionsType.multiChoice)}
              >
                <UiText message={"Add"} />{" "}
                <strong>
                  <UiText message={"multi-select"} />
                </strong>{" "}
                <UiText message={"group of variants"} />
              </Menu.Item>,
            );
          })
          .build({
            menuName: "variantspanel-add-variant-group",
          });

    if (!vcontroller || !variantInput) {
      return null;
    }

    const canChangeVariants = variantInput.canChangeVariants;
    const superComps = getSuperComponents(component);

    const styleOrCodeComponentVariants =
      allComponentStyleOrCodeComponentVariants(component);
    const baseVariant = getBaseVariant(component);
    const combos = findNonEmptyCombos(component);
    const selectedVariants = variantInput.targetedVariants;
    const [relevantCombos, otherCombos] = partitions(combos, [
      (combo) => selectedVariants.every((v) => combo.includes(v)),
    ]);

    const onAddedVariant = (variant: Variant) => {
      if (!world.isCurrent()) { return; }
      vcontroller.onAddedVariant(variant, { focusFrame: false });
      setJustAddedVariant(variant);
    };

    const addVariantGroup = (optionsType: VariantOptionsType) =>
      studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
        const group = studioCtx
          .tplMgr()
          .createVariantGroup({ component, optionsType });

        if (optionsType === VariantOptionsType.standalone) {
          onAddedVariant(group.variants[0]);
        } else {
          setJustAddedGroup(group);
        }
        return ok();
      });

    const onRenameVariantGroup = async (
      group: VariantGroup,
      newName: string,
    ) => {
      return studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
        studioCtx.siteOps().tryRenameVariantGroup(group, newName);

        if (justAddedGroup === group && !group.variants.length) {
          const variant = isGlobalVariantGroup(group)
            ? studioCtx.tplMgr().createGlobalVariant(group)
            : studioCtx.tplMgr().createVariant(component, group);
          onAddedVariant(variant);
          setJustAddedVariant(variant);
        }

        setJustAddedGroup(undefined);

        return ok();
      });
    };

    const root = ensureInstance(component.tplTree, TplTag, TplComponent);

    const maybeReorderableVariants = (
      group: VariantGroup,
      children: React.ReactElement<{ isDraggable?: boolean }>[],
    ) => {
      if (group.variants.length > 1) {
        return (
          <SimpleReorderableList
            onReordered={(fromIndex, toIndex) =>
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                moveVariant({
                  site: studioCtx.site,
                  component,
                  variantGroup: group,
                  fromIndex,
                  toIndex,
                });
                return ok();
              })
            }
            customDragHandle
          >
            {children.map((child) =>
              React.cloneElement(child, { isDraggable: true }),
            )}
          </SimpleReorderableList>
        );
      } else {
        return children;
      }
    };

    const makeReadOnlyGroupSection = (
      c: Component,
      group: VariantGroup,
      opts: {
        dep?: ProjectDependency;
        onClickSettings?: () => void;
        icon?: React.ReactNode;
      } = {},
    ) => {
      return makeReadOnlySection({
        viewCtx: viewCtx,
        studioCtx: studioCtx,
        key: group.uuid,
        vcontroller,
        icon: opts.icon ?? <Icon icon={GlobeIcon} />,
        showIcon: !!opts.icon,
        title: `${group.param.variable.name} ${
          opts.dep
            ? uiT('(from "{part1}")', { part1: String(opts.dep.name) })
            : ""
        }`,
        onClickSettings: opts.onClickSettings,
        variants: group.variants,
        component: c,
      });
    };

    const handleAddGlobalGroupOfVariants = (e) => {
      globalVariantsSectionRef.current?.expand();
      return void studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
        e.stopPropagation();
        const group = studioCtx.tplMgr().createGlobalVariantGroup();
        setJustAddedGroup(isScreenVariantGroup(group) ? undefined : group);
        setExpandGlobals(true);
        return ok();
      });
    };

    const onClickCombo = (combo) =>
      studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
        vcontroller.onClickCombo(combo);
        return ok();
      });

    const onActivateCombo = (combo) =>
      studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
        vcontroller.onActivateCombo(combo);
        return ok();
      });

    const tplRoot = component.tplTree;

    return (
      <div
        className="pass-through"
        {...({
          "data-test-id": "variants-tab",
          "data-event-variants-panel-type":
            vcontroller instanceof CustomVariantsController
              ? "custom"
              : vcontroller instanceof PageArenaVariantsController
                ? "page"
                : vcontroller instanceof ComponentArenaVariantsController
                  ? "component"
                  : undefined,
        } as any)}
      >
        <SidebarSection
          zeroBodyPadding
          title={
            <LabelWithDetailedTooltip tooltip={<VariantsTooltip />}>
              {isPageComponent(component)
                ? uiT("Page Variants")
                : uiT("Component Variants")}
            </LabelWithDetailedTooltip>
          }
          controls={
            <div
              className={"pass-through"}
              data-test-id="add-variant-group-button"
              data-event="variantspanel-add-variant"
            >
              <IFrameAwareDropdownMenu menu={addVariantsMenu}>
                <Button
                  type="text"
                  size="small"
                  aria-label={uiT("Add variant")}
                  icon={<Icon icon={PlusIcon} />}
                />
              </IFrameAwareDropdownMenu>
            </div>
          }
        >
          <>
            <VariantRow
              studioCtx={studioCtx}
              viewCtx={viewCtx}
              variant={baseVariant}
              pinState={
                (variantInput.targetedVariants.length === 1 && isBaseVariant(variantInput.targetedVariants[0]))
                  ? "selected-pinned"
                  : undefined
              }
              onClick={() =>
                studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                  vcontroller.onClearVariants();
                  return ok();
                })
              }
              label={uiT("Base")}
            />

            <SimpleReorderableList
              onReordered={(fromIndex, toIndex) =>
                studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                  moveVariantGroup({
                    site: studioCtx.site,
                    component,
                    fromIndex,
                    toIndex,
                  });
                  return ok();
                })
              }
              customDragHandle
            >
              {component.variantGroups.map((group) =>
                isStandaloneVariantGroup(group) ? (
                  <StandaloneVariant
                    studioCtx={studioCtx}
                    component={component}
                    key={group.uuid}
                    viewCtx={viewCtx}
                    group={group}
                    pinState={variantInput.variants[group.variants[0].uid]?.pinState}
                    onClick={() =>
                      studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                        vcontroller.onClickVariant(group.variants[0]);
                        return ok();
                      })
                    }
                    onTarget={
                      canChangeVariants ||
                      variantInput.variants[group.variants[0].uid]?.canToggle
                        ? (target) =>
                            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                              vcontroller.onTargetVariant(
                                group.variants[0],
                                target,
                              );
                              return ok();
                            })
                        : undefined
                    }
                    onToggle={
                      canChangeVariants
                        ? () =>
                            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                              vcontroller.onToggleVariant(group.variants[0]);
                              return ok();
                            })
                        : undefined
                    }
                    defaultEditing={group.variants[0] === justAddedVariant}
                    onClone={({ variants }) => setJustAddedVariant(variants[0])}
                    onRenamed={() => setJustAddedVariant(undefined)}
                    isDraggable
                  />
                ) : (
                  <ComponentVariantGroupSection
                    key={group.uuid}
                    studioCtx={studioCtx}
                    viewCtx={viewCtx}
                    group={group}
                    justAdded={group === justAddedGroup}
                    component={component}
                    onRename={(name) => onRenameVariantGroup(group, name)}
                    onAddedVariant={onAddedVariant}
                    isDraggable
                  >
                    {maybeReorderableVariants(
                      group,
                      group.variants.map((variant) => (
                        <ComponentVariantRow
                          key={variant.uuid}
                          component={component}
                          variant={variant}
                          studioCtx={studioCtx}
                          viewCtx={viewCtx}
                          pinState={variantInput.variants[variant.uid]?.pinState}
                          onClick={() =>
                            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                              vcontroller.onClickVariant(variant);
                              return ok();
                            })
                          }
                          onTarget={
                            canChangeVariants ||
                            variantInput.variants[variant.uid]?.canToggle
                              ? (target) =>
                                  studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                    vcontroller.onTargetVariant(
                                      variant,
                                      target,
                                    );
                                    return ok();
                                  })
                              : undefined
                          }
                          onToggle={
                            canChangeVariants
                              ? () =>
                                  studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                    vcontroller.onToggleVariant(variant);
                                    return ok();
                                  })
                              : undefined
                          }
                          defaultEditing={variant === justAddedVariant}
                          onRenamed={() => setJustAddedVariant(undefined)}
                        />
                      )),
                    )}
                  </ComponentVariantGroupSection>
                ),
              )}
            </SimpleReorderableList>
            {canHaveStyleOrCodeComponentVariant(component) &&
              !isPageComponent(component) && (
                <VariantSection
                  showIcon
                  icon={<Icon icon={BoltIcon} />}
                  title={
                    isTplRootWithCodeComponentVariants(tplRoot)
                      ? uiT("Registered Variants")
                      : uiT("Interaction Variants")
                  }
                  emptyAddButtonText={uiT("Add variant")}
                  emptyAddButtonTooltip={
                    isTplRootWithCodeComponentVariants(tplRoot)
                      ? "Registered variants are registered in code component meta"
                      : "Interaction variants are automatically activated when the user interacts with the component -- by hovering, focusing, pressing, etc."
                  }
                  onAddNewVariant={() =>
                    studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                      isTplCodeComponent(tplRoot)
                        ? studioCtx
                            .siteOps()
                            .createCodeComponentVariant(
                              component,
                              tplRoot.component.name,
                            )
                        : studioCtx.siteOps().createStyleVariant(component);
                      return ok();
                    })
                  }
                  isQuiet
                >
                  {styleOrCodeComponentVariants.map((variant) => (
                    <ComponentStyleVariantRow
                      key={variant.uuid}
                      variant={variant}
                      component={component}
                      studioCtx={studioCtx}
                      viewCtx={viewCtx}
                      pinState={variantInput.variants[variant.uid]?.pinState}
                      onClick={() =>
                        justAddedVariant !== variant &&
                        studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                          vcontroller.onClickVariant(variant);
                          return ok();
                        })
                      }
                      onTarget={
                        canChangeVariants ||
                        variantInput.variants[variant.uid]?.canToggle
                          ? (target) =>
                              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                vcontroller.onTargetVariant(variant, target);
                                return ok();
                              })
                          : undefined
                      }
                      onToggle={
                        canChangeVariants
                          ? () =>
                              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                vcontroller.onToggleVariant(variant);
                                return ok();
                              })
                          : undefined
                      }
                      defaultEditing={variant === justAddedVariant}
                      onEdited={() => setJustAddedVariant(undefined)}
                    />
                  ))}
                </VariantSection>
              )}

            {superComps.map((superComp) => (
              <SuperComponentVariantsSection
                key={superComp.uuid}
                component={superComp}
                studioCtx={studioCtx}
                viewCtx={viewCtx}
                vcontroller={vcontroller}
              />
            ))}
          </>
        </SidebarSection>
        <SidebarSection
          ref={globalVariantsSectionRef}
          title={
            <LabelWithDetailedTooltip tooltip={<GlobalVariantsTooltip />}>
              <UiText message={"Global Variants"} />
            </LabelWithDetailedTooltip>
          }
          controls={
            <Tooltip title={uiT("Add group of variants")}>
              <Button
                type="text"
                size="small"
                aria-label={uiT("Add group of variants")}
                onClick={handleAddGlobalGroupOfVariants}
                icon={
                  <Icon
                    data-test-id="add-global-variant-group-button"
                    icon={PlusIcon}
                  />
                }
              />
            </Tooltip>
          }
          defaultExpanded={expandGlobals}
          onExtraContentExpanded={() => setExpandGlobals(true)}
          zeroBodyPadding
          hasExtraContent
          fullyCollapsible
          noBottomPadding
          {...testIds.globalVariantsHeader}
        >
          {(renderMaybeCollapsibleRows) =>
            renderMaybeCollapsibleRows(
              [
                {
                  collapsible: true,
                  content: (
                    <>
                      {site.activeScreenVariantGroup &&
                        makeReadOnlyGroupSection(
                          component,
                          site.activeScreenVariantGroup,
                          {
                            icon: <Icon icon={ScreenIcon} />,
                            onClickSettings: () =>
                              spawn(
                                studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                  studioCtx.switchLeftTab("responsiveness", {
                                    highlight: true,
                                  });
                                  return ok();
                                }),
                              ),
                            dep: studioCtx.projectDependencyManager.getOwnerDep(
                              site.activeScreenVariantGroup,
                            ),
                          },
                        )}
                      {[
                        ...site.globalVariantGroups
                          .filter((group) => !isScreenVariantGroup(group))
                          .map((group) => (
                            <GlobalVariantGroupSection
                              key={group.uuid}
                              studioCtx={studioCtx}
                              viewCtx={viewCtx}
                              group={group}
                              defaultEditing={group === justAddedGroup}
                              onRename={(name) =>
                                onRenameVariantGroup(group, name)
                              }
                              onAddedVariant={onAddedVariant}
                            >
                              {maybeReorderableVariants(
                                group,
                                group.variants.map((variant) => (
                                  <GlobalVariantRow
                                    key={variant.uuid}
                                    component={component}
                                    variant={variant}
                                    studioCtx={studioCtx}
                                    viewCtx={viewCtx}
                                    pinState={variantInput.variants[variant.uid]?.pinState}
                                    onClick={() =>
                                      studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                        vcontroller.onClickVariant(variant);
                                        return ok();
                                      })
                                    }
                                    onTarget={
                                      canChangeVariants ||
                                      variantInput.variants[variant.uid]?.canToggle
                                        ? (target) =>
                                            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                              vcontroller.onTargetVariant(
                                                variant,
                                                target,
                                              );
                                              return ok();
                                            })
                                        : undefined
                                    }
                                    onToggle={
                                      canChangeVariants
                                        ? () =>
                                            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                                              vcontroller.onToggleVariant(
                                                variant,
                                              );
                                              return ok();
                                            })
                                        : undefined
                                    }
                                    defaultEditing={
                                      variant === justAddedVariant
                                    }
                                    onRenamed={() =>
                                      setJustAddedVariant(undefined)
                                    }
                                  />
                                )),
                              )}
                            </GlobalVariantGroupSection>
                          )),

                        ...site.projectDependencies.flatMap((dep) =>
                          dep.site.globalVariantGroups
                            .filter((group) => !isScreenVariantGroup(group))
                            .map((group) =>
                              makeReadOnlyGroupSection(component, group, {
                                dep,
                              }),
                            ),
                        ),
                      ]}
                    </>
                  ),
                },
              ],
              { alwaysVisible: true },
            )
          }
        </SidebarSection>

        <SidebarSection
          title={
            <LabelWithDetailedTooltip tooltip={<VariantCombosTooltip />}>
              <UiText message={"Combinations"} />
            </LabelWithDetailedTooltip>
          }
          zeroBodyPadding
          hasExtraContent
          fullyCollapsible
          noBottomPadding
        >
          {(renderMaybeCollapsibleRows) =>
            renderMaybeCollapsibleRows(
              [
                {
                  collapsible: true,
                  content: (
                    <>
                      {sortBy(relevantCombos, (combo) => combo.length).map(
                        (combo) => (
                          <VariantComboRow
                            key={variantComboKey(combo)}
                            combo={combo}
                            onClick={
                              onClickCombo
                                ? () => onClickCombo(combo)
                                : undefined
                            }
                            onActivate={
                              onActivateCombo
                                ? () => onActivateCombo(combo)
                                : undefined
                            }
                            viewCtx={viewCtx}
                          />
                        ),
                      )}
                      {sortBy(
                        otherCombos,
                        (combo) =>
                          -1 *
                          combo.filter((v) => selectedVariants.includes(v))
                            .length,
                      ).map((combo) => (
                        <VariantComboRow
                          key={variantComboKey(combo)}
                          combo={combo}
                          onClick={() => onClickCombo(combo)}
                          onActivate={() => onActivateCombo(combo)}
                          viewCtx={viewCtx}
                        />
                      ))}
                    </>
                  ),
                },
              ],
              { alwaysVisible: true },
            )
          }
        </SidebarSection>
      </div>
    );
  }),
);

const ComponentVariantRow = React.memo(function ComponentVariantRow(props: React.ComponentProps<typeof ComponentVariantRowContent>) {
  const world = useVariantModelWorld(props.studioCtx, props.variant, props.viewCtx);
  return world.alive ? <ComponentVariantRowContent {...props} /> : null;
});
const ComponentVariantRowContent = React.memo(function ComponentVariantRow_(props: {
  studioCtx: StudioCtx;
  viewCtx?: ViewCtx;
  component: Component;
  variant: Variant;
  pinState: VariantPinState | undefined;
  defaultEditing?: boolean;
  onRenamed: () => void;
  isDragging?: boolean;
  isDraggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  onClick?: () => void;
  onTarget?: (target: boolean) => void;
  onToggle?: () => void;
}) {
  const {
    studioCtx,
    viewCtx,
    variant,
    component,
    pinState,
    defaultEditing,
    onRenamed,
    isDragging,
    isDraggable,
    dragHandleProps,
    onClick,
    onTarget,
    onToggle,
  } = props;
  const world = useVariantModelWorld(studioCtx, variant, props.viewCtx);
  useVariantLabelInputs(studioCtx, variant, { component, splitGroup: true });
  const [label, setLabel] = React.useState<EditableLabelHandles | null>(null);
  const plumeDef = getPlumeVariantDef(component, variant);
  return (
    <VariantRow
      key={variant.uuid}
      variant={variant}
      studioCtx={studioCtx}
      viewCtx={viewCtx}
      pinState={pinState}
      isDraggable={isDraggable}
      isDragging={isDragging}
      dragHandleProps={dragHandleProps}
      onClick={onClick}
      onTarget={onTarget}
      onToggle={onToggle}
      plumeDef={plumeDef}
      menu={makeVariantMenu({
        variant,
        component,
        onRemove: () =>
          spawn(
            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
              spawn(studioCtx.siteOps().removeVariant(component, variant));
              return ok();
            }),
          ),

        onClone: () =>
          spawn(
            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
              studioCtx.tplMgr().cloneVariant(component, variant);
              return ok();
            }),
          ),

        onCopyTo: (toVariant) =>
          spawn(
            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
              studioCtx.tplMgr().copyToVariant(component, variant, toVariant);
              return ok();
            }),
          ),

        onMove: (toGroup) =>
          spawn(
            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
              studioCtx.tplMgr().moveVariant(component, variant, toGroup);
              return ok();
            }),
          ),

        onRename: () => label && label.setEditing(true),
      })}
      label={
        <VariantLabel
          ref={setLabel}
          doubleClickToEdit
          variant={variant}
          defaultEditing={defaultEditing}
          onRenamed={onRenamed}
        />
      }
    />
  );
});
const GlobalVariantRow = React.memo(function GlobalVariantRow(props: React.ComponentProps<typeof GlobalVariantRowContent>) {
  const world = useVariantModelWorld(props.studioCtx, props.variant, props.viewCtx);
  return world.alive ? <GlobalVariantRowContent {...props} /> : null;
});
const GlobalVariantRowContent = React.memo(function GlobalVariantRow_(props: {
  studioCtx: StudioCtx;
  viewCtx?: ViewCtx;
  component: Component;
  pinState: VariantPinState | undefined;
  variant: Variant;
  defaultEditing?: boolean;
  onRenamed: () => void;
  isDragging?: boolean;
  isDraggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  onClick?: () => void;
  onTarget?: (target: boolean) => void;
  onToggle?: () => void;
}) {
  const {
    studioCtx,
    viewCtx,
    component,
    variant,
    pinState,
    defaultEditing,
    onRenamed,
    isDragging,
    isDraggable,
    dragHandleProps,
    onClick,
    onTarget,
    onToggle,
  } = props;
  const world = useVariantModelWorld(studioCtx, variant, props.viewCtx);
  useVariantLabelInputs(studioCtx, variant, { component, splitGroup: true });
  const [label, setLabel] = React.useState<EditableLabelHandles | null>(null);

  const isSplitsVariant = isVariantUsedInSplits(studioCtx.site, variant);

  return (
    <VariantRow
      key={variant.uuid}
      studioCtx={studioCtx}
      variant={variant}
      viewCtx={viewCtx}
      pinState={pinState}
      onClick={onClick}
      isSplitVariant={isSplitsVariant}
      onTarget={onTarget}
      onToggle={onToggle}
      menu={makeVariantMenu({
        variant,
        component,
        onCopyTo: (toVariant) =>
          spawn(
            studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
              studioCtx.tplMgr().copyToVariant(component, variant, toVariant);
              return ok();
            }),
          ),
        // Splits variants can't be removed independently of the split if it's
        // not through the split editor
        onRemove: !isSplitsVariant
          ? () =>
              spawn(
                studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                  spawn(studioCtx.siteOps().removeGlobalVariant(variant));
                  return ok();
                }),
              )
          : undefined,
        onRename: !isSplitsVariant
          ? () => label && label.setEditing(true)
          : undefined,
      })}
      label={
        isSplitsVariant ? (
          variant.parent?.param.variable.name
        ) : (
          <VariantLabel
            ref={setLabel}
            doubleClickToEdit
            variant={variant}
            defaultEditing={defaultEditing}
            onRenamed={onRenamed}
          />
        )
      }
      isDragging={isDragging}
      isDraggable={isDraggable}
      dragHandleProps={dragHandleProps}
    />
  );
});

const ComponentStyleVariantRow = React.memo(function ComponentStyleVariantRow(props: React.ComponentProps<typeof ComponentStyleVariantRowContent>) {
  const world = useVariantModelWorld(props.studioCtx, props.variant, props.viewCtx);
  return world.alive ? <ComponentStyleVariantRowContent {...props} /> : null;
});
const ComponentStyleVariantRowContent = React.memo(
  function ComponentStyleVariantRow_(props: {
    studioCtx: StudioCtx;
    viewCtx?: ViewCtx;
    component: Component;
    pinState: VariantPinState | undefined;
    variant: StyleOrCodeComponentVariant;
    defaultEditing?: boolean;
    onEdited: () => void;
    onClick?: () => void;
    onTarget?: (target: boolean) => void;
    onToggle?: () => void;
  }) {
    const {
      studioCtx,
      viewCtx,
      component,
      pinState,
      variant,
      defaultEditing,
      onEdited,
      onClick,
      onTarget,
      onToggle,
    } = props;
  const world = useVariantModelWorld(studioCtx, variant, props.viewCtx);
  useVariantLabelInputs(studioCtx, variant, { component, splitGroup: true });
    const [label, setLabel] = React.useState<EditableLabelHandles | null>(null);

    return (
      <VariantRow
        key={variant.uuid}
        variant={variant}
        studioCtx={studioCtx}
        viewCtx={viewCtx}
        pinState={pinState}
        onClick={onClick}
        onTarget={onTarget}
        onToggle={onToggle}
        menu={makeVariantMenu({
          variant,
          component,
          onRemove: () =>
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                spawn(studioCtx.siteOps().removeVariant(component, variant));
                return ok();
              }),
            ),
          onCopyTo: (toVariant) =>
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                studioCtx.tplMgr().copyToVariant(component, variant, toVariant);
                return ok();
              }),
            ),

          onEditSelectors: () => label && label.setEditing(true),
        })}
        label={
          <StyleOrCodeComponentVariantLabel
            component={component}
            variant={variant}
            forTag={
              isKnownTplTag(component.tplTree) ? component.tplTree.tag : ""
            }
            forRoot={true}
            ref={setLabel}
            onBlur={() => {
              onEdited();
            }}
            defaultEditing={defaultEditing}
          />
        }
      />
    );
  },
);

const ComponentVariantGroupSection = React.memo(function ComponentVariantGroupSection(props: React.ComponentProps<typeof ComponentVariantGroupSectionContent>) {
  const world = useVariantModelWorld(props.studioCtx, props.group, props.viewCtx);
  return world.alive ? <ComponentVariantGroupSectionContent {...props} /> : null;
});
const ComponentVariantGroupSectionContent = React.memo(
  function ComponentVariantGroupSection_(props: {
    studioCtx: StudioCtx;
    viewCtx?: ViewCtx;
    group: ComponentVariantGroup;
    component: Component;
    justAdded?: boolean;
    children: React.ReactNode;
    onAddedVariant: (variant: Variant) => void;
    onRename: (name: string) => void;
    icon?: React.FC;
    isDragging?: boolean;
    isDraggable?: boolean;
    dragHandleProps?: DraggableProvidedDragHandleProps;
  }) {
    const { t: studioUiT } = useI18n();

    const {
      studioCtx,
      group,
      justAdded,
      component,
      children,
      onAddedVariant,
      onRename,
      icon,
      isDragging,
      isDraggable,
      dragHandleProps,
    } = props;

    const hasCodeExpression = !!group.param.defaultExpr;
    const [visibleDataPicker, setVisibleDataPicker] = React.useState(false);

  const world = useVariantModelWorld(studioCtx, group, props.viewCtx);
  useVariantLabelInputs(studioCtx, group.variants, { component, group, splitGroup: true });
  usePropExpressionInputs(studioCtx, group, group.param, undefined);
    const [label, setLabel] = React.useState<EditableLabelHandles | null>(null);
    return (
      <VariantSection
        key={group.uuid}
        icon={<Icon icon={icon || VariantGroupIcon} />}
        isDraggable={isDraggable}
        isDragging={isDragging}
        dragHandleProps={dragHandleProps}
        title={
          <EditableGroupLabel
            group={group}
            defaultEditing={justAdded}
            onEdit={(name) => onRename(name)}
            ref={setLabel}
          />
        }
        emptyAddButtonText={studioUiT("Add variant option")}
        onAddNewVariant={
          justAdded
            ? undefined
            : () =>
                studioCtx
                  .change(() => {
                  if (!world.isCurrent()) { return ok(); }
                    const variant = studioCtx
                      .tplMgr()
                      .createVariant(component, group);
                    onAddedVariant(variant);
                    return ok();
                  })
                  .then(() => { if (world.isCurrent()) { notifyLinkedPropDrift(studioCtx, component, group.param); } })
        }
        hasCodeExpression={hasCodeExpression}
        exprButton={{
          wrap: (node) => (
            <VariantDataPicker
              studioCtx={studioCtx}
              component={component}
              group={group}
              visibleDataPicker={visibleDataPicker}
              setVisibleDataPicker={setVisibleDataPicker}
            >
              {node}
            </VariantDataPicker>
          ),
        }}
        menu={makeVariantGroupMenu({
          group,
          onToggleMulti: () =>
            spawn(
              studioCtx
                .change(() => {
                  if (!world.isCurrent()) { return ok(); }
                  studioCtx
                    .siteOps()
                    .updateVariantGroupMulti(group, !group.multi);
                  return ok();
                })
                .then(() => { if (world.isCurrent()) { notifyLinkedPropDrift(studioCtx, component, group.param); } }),
            ),

          onRemove: () =>
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                spawn(studioCtx.siteOps().removeVariantGroup(component, group));
                return ok();
              }),
            ),

          onChangeAccessType: (accessType) => {
            const state = ensure(
              group.linkedState,
              "Variant group is expected to have linked state",
            );
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                studioCtx.siteOps().updateState(state, {
                  accessType,
                });
                return ok();
              }),
            );
          },

          onRename: () => label && label.setEditing(true),

          onEditDynamicValue: () => {
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                if (!group.param.defaultExpr) {
                  studioCtx.siteOps().updateState(group.linkedState, {
                    initialValue: new ObjectPath({
                      path: ["undefined"],
                      fallback: null,
                    }),
                  });
                }
                setVisibleDataPicker(true);
                return ok();
              }),
            );
          },

          onRemoveDynamicValue: () => {
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                studioCtx.siteOps().updateState(group.linkedState, {
                  initialValue: null,
                });
                return ok();
              }),
            );
          },
        })}
      >
        {children}
      </VariantSection>
    );
  },
);

const GlobalVariantGroupSection = React.memo(function GlobalVariantGroupSection(props: React.ComponentProps<typeof GlobalVariantGroupSectionContent>) {
  const world = useVariantModelWorld(props.studioCtx, props.group, props.viewCtx);
  return world.alive ? <GlobalVariantGroupSectionContent {...props} /> : null;
});
const GlobalVariantGroupSectionContent = React.memo(
  function GlobalVariantGroupSection_(props: {
    studioCtx: StudioCtx;
    viewCtx?: ViewCtx;
    group: VariantGroup;
    defaultEditing?: boolean;
    children: React.ReactNode;
    icon?: React.ReactNode;
    onAddedVariant: (variant: Variant) => void;
    onRename: (name: string) => void;
  }) {
    const {
      studioCtx,
      group,
      defaultEditing,
      children,
      onAddedVariant,
      onRename,
      icon,
    } = props;

    const isSplitsGroup = isGlobalVariantGroupUsedInSplits(
      studioCtx.site,
      group,
    );

  const world = useVariantModelWorld(studioCtx, group, props.viewCtx);
  useVariantLabelInputs(studioCtx, group.variants, { group, splitGroup: true });
  usePropExpressionInputs(studioCtx, group, group.param, undefined);
    const [label, setLabel] = React.useState<EditableLabelHandles | null>(null);

    // For split variant groups with only one variant, just render the child row directly
    if (isSplitsGroup) {
      return <>{children}</>;
    }

    return (
      <VariantSection
        key={group.uuid}
        icon={icon}
        showIcon={!!icon}
        title={
          <EditableGroupLabel
            group={group}
            defaultEditing={defaultEditing}
            onEdit={(name) => onRename(name)}
            ref={setLabel}
          />
        }
        // We don't allow adding new variants to split groups as they
        // should be handled by the split editor
        onAddNewVariant={
          !isSplitsGroup
            ? () =>
                studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                  const variant = studioCtx.tplMgr().createGlobalVariant(group);
                  if (isScreenVariantGroup(group)) {
                    variant.mediaQuery = new ScreenSizeSpec(0).query();
                  }
                  onAddedVariant(variant);
                  return ok();
                })
            : undefined
        }
        menu={makeVariantGroupMenu({
          group,
          onToggleMulti: () =>
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                studioCtx
                  .siteOps()
                  .updateVariantGroupMulti(group, !group.multi);
                return ok();
              }),
            ),

          onRemove: () =>
            spawn(
              studioCtx.change(() => {
                  if (!world.isCurrent()) { return ok(); }
                spawn(studioCtx.siteOps().removeGlobalVariantGroup(group));
                return ok();
              }),
            ),

          onRename: () => {
            if (label) {
              label.setEditing(true);
            }
          },
        })}
      >
        {children}
      </VariantSection>
    );
  },
);
