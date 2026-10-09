import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";
import ExperimentCanvasButton from "@/wab/client/components/splits/ExperimentCanvasButton";
import sty from "@/wab/client/components/studio/arenas/ComponentArenaLayout.module.sass";
import {
  GhostFrame,
  GhostFrameRef,
} from "@/wab/client/components/studio/arenas/GhostFrame";
import { GridFramesLayout } from "@/wab/client/components/studio/arenas/GridFramesLayout";
import { VariantComboPicker } from "@/wab/client/components/variants/VariantComboPicker";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import {
  EditableLabel,
  EditableLabelHandles,
} from "@/wab/client/components/widgets/EditableLabel";
import { useRefMap } from "@/wab/client/hooks/useRefMap";
import { useResponsiveBreakpoints } from "@/wab/client/hooks/useResponsiveBreakpoints";
import { useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import {
  ensureCustomFrameForActivatedVariants,
  getFrameHeight,
} from "@/wab/shared/Arenas";
import {
  COMBINATIONS_CAP,
  FRAME_LOWER,
  VARIANTS_LOWER,
  VARIANT_CAP,
} from "@/wab/shared/Labels";
import { VariantOptionsType } from "@/wab/shared/TplMgr";
import {
  VariantCombo,
  canHaveStyleOrCodeComponentVariant,
  isGlobalVariantGroup,
  isScreenVariantGroup,
  isStandaloneVariantGroup,
} from "@/wab/shared/Variants";
import { isTplRootWithCodeComponentVariants } from "@/wab/shared/code-components/variants";
import { maybe, spawn } from "@/wab/shared/common";
import { getComponentArenaRowLabel } from "@/wab/shared/component-arenas";
import {
  allComponentVariants,
  getSuperComponentVariantGroupToComponent,
} from "@/wab/shared/core/components";
import { allGlobalVariantGroups } from "@/wab/shared/core/sites";
import { isGlobalVariantGroupUsedInSplits } from "@/wab/shared/core/splits";
import { isTplCodeComponent } from "@/wab/shared/core/tpls";
import {
  ArenaFrame,
  ArenaFrameRow,
  Component,
  ComponentArena,
  PageArena,
  Site,
  VariantGroup,
  ensureKnownComponentVariantGroup,
  ensureMaybeKnownVariantGroup,
  isKnownVariantGroup,
} from "@/wab/shared/model/classes";
import { Button, Form, Menu, Popover } from "antd";
import cn from "classnames";
import { observer } from "mobx-react";
import React, { useLayoutEffect, useRef } from "react";

export const ComponentArenaLayout = observer(
  function ComponentArenaLayout(props: {
    studioCtx: StudioCtx;
    arena: ComponentArena;
    onFrameLoad: (frame: ArenaFrame, canvasCtx: CanvasCtx) => void;
  }) {
    const { t: uiT } = useI18n();
    const { studioCtx, arena, onFrameLoad } = props;
    const component = arena.component;

    const componentVariants = allComponentVariants(component);
    const globalVariantGroups = allGlobalVariantGroups(studioCtx.site, {
      includeDeps: "direct",
      excludeEmpty: true,
      excludeInactiveScreenVariants: true,
    });

    const allowCombos =
      componentVariants.length + globalVariantGroups.length > 2;
    const framesHeight = maybe(arena.matrix.rows[0]?.cols[0]?.frame, (frame) =>
      getFrameHeight(frame),
    );
    const framesWidth = arena.matrix.rows[0]?.cols[0]?.frame.width;

    const groupToSuperComp =
      getSuperComponentVariantGroupToComponent(component);

    const handleRowLabelChanged = (row: ArenaFrameRow) => (newName: string) => {
      spawn(
        studioCtx.changeUnsafe(() => {
          if (isKnownVariantGroup(row.rowKey)) {
            studioCtx.siteOps().tryRenameVariantGroup(row.rowKey, newName);

            if (row.rowKey.variants.length === 0) {
              studioCtx
                .siteOps()
                .createVariant(
                  component,
                  ensureKnownComponentVariantGroup(row.rowKey),
                );
            }
          }
        }),
      );
    };

    const variantGroupsEditableLabelRefs = useRefMap<
      VariantGroup,
      EditableLabelHandles
    >();

    useLayoutEffect(() => {
      const variantGroupLabelRef =
        studioCtx.latestVariantGroupCreated &&
        variantGroupsEditableLabelRefs(studioCtx.latestVariantGroupCreated);

      if (variantGroupLabelRef) {
        variantGroupLabelRef.current?.setEditing(true);
        studioCtx.latestVariantGroupCreated = undefined;
      }
    }, [studioCtx.latestVariantGroupCreated]);

    const handleAddToggleVariant = () =>
      studioCtx.changeUnsafe(() =>
        studioCtx
          .siteOps()
          .createVariantGroup(component, VariantOptionsType.standalone),
      );

    const handleAddSingleSelectVariantGroup = () =>
      studioCtx.changeUnsafe(() =>
        studioCtx
          .siteOps()
          .createVariantGroup(component, VariantOptionsType.singleChoice),
      );

    const handleAddMultiSelectVariantGroup = () =>
      studioCtx.changeUnsafe(() =>
        studioCtx
          .siteOps()
          .createVariantGroup(component, VariantOptionsType.multiChoice),
      );

    const handleAddVariantToGroup = (group: VariantGroup) => () =>
      studioCtx.changeUnsafe(() => {
        if (isGlobalVariantGroup(group)) {
          studioCtx.siteOps().createGlobalVariant(group);
        } else {
          studioCtx.siteOps().createVariant(component, group);
        }
      });

    const handleAddResponsiveBreakpoints = () =>
      studioCtx.changeUnsafe(() =>
        studioCtx.switchLeftTab("responsiveness", {
          highlight: true,
        }),
      );

    const { orderedScreenVariants } = useResponsiveBreakpoints();
    const isShowingScreenVariantsGroup = arena.matrix.rows.some(
      (it) => isKnownVariantGroup(it.rowKey) && isScreenVariantGroup(it.rowKey),
    );

    const vController = makeVariantsController(studioCtx);
    const tplRoot = component.tplTree;
    return (
      <div>
        <GridFramesLayout
          arena={arena}
          grid={arena.matrix}
          onFrameLoad={onFrameLoad}
          makeRowLabel={(row) => (
            <MaybeWrap
              cond={!!row.rowKey}
              wrapper={(children) => (
                <EditableLabel
                  ref={variantGroupsEditableLabelRefs(
                    row.rowKey as VariantGroup,
                  )}
                  onEdit={handleRowLabelChanged(row)}
                  value={getComponentArenaRowLabel(component, row)}
                  inputBoxPlaceholder={
                    isKnownVariantGroup(row.rowKey) &&
                    isStandaloneVariantGroup(row.rowKey)
                      ? `${VARIANT_CAP} name`
                      : `Group name`
                  }
                >
                  {children}
                </EditableLabel>
              )}
            >
              <div
                className={cn(sty.groupLabel, {
                  [sty.groupLabel__editable]: row.rowKey,
                })}
                onContextMenu={(e) => {
                  if (isKnownVariantGroup(row.rowKey)) {
                    maybeShowContextMenu(
                      e as any,
                      <Menu>
                        <Menu.Item
                          onClick={() => {
                            variantGroupsEditableLabelRefs(
                              row.rowKey as VariantGroup,
                            )?.current?.setEditing(true);
                          }}
                        >
                          <UiText message={"Rename"} />
                        </Menu.Item>
                      </Menu>,
                    );
                  }
                }}
              >
                {getComponentArenaRowLabel(component, row)}
              </div>
            </MaybeWrap>
          )}
          makeRowLabelControls={(row, _index) => {
            const group = ensureMaybeKnownVariantGroup(row.rowKey);

            if (!group) {
              return null;
            }

            return <ExperimentCanvasButton group={group} />;
          }}
          rowEndControls={(row) => {
            const group = ensureMaybeKnownVariantGroup(row.rowKey);
            if (!group) {
              if (!canHaveStyleOrCodeComponentVariant(component)) {
                return null;
              }
              return (
                <GhostFrame
                  tooltip={`Add ${
                    isTplRootWithCodeComponentVariants(component.tplTree)
                      ? "registered"
                      : "interaction"
                  } variant`}
                  width={framesWidth}
                  height={framesHeight}
                  onClick={() =>
                    studioCtx.changeUnsafe(() =>
                      isTplCodeComponent(tplRoot)
                        ? studioCtx
                            .siteOps()
                            .createCodeComponentVariant(
                              component,
                              tplRoot.component.name,
                            )
                        : studioCtx.siteOps().createStyleVariant(component),
                    )
                  }
                  data-event="component-arena-add-interaction-variant"
                />
              );
            } else if (groupToSuperComp.has(group)) {
              return null;
            } else if (isStandaloneVariantGroup(group)) {
              return null;
            } else if (studioCtx.projectDependencyManager.getOwnerDep(group)) {
              // Can't edit groups not owned by this site
              return null;
            } else if (
              isGlobalVariantGroupUsedInSplits(studioCtx.site, group)
            ) {
              // Can't edit groups used by splits
              return null;
            } else if (isScreenVariantGroup(group)) {
              return (
                <GhostFrame
                  tooltip={uiT("Add more responsive breakpoints")}
                  width={framesWidth}
                  height={framesHeight}
                  onClick={handleAddResponsiveBreakpoints}
                  data-event="component-arena-add-screen-variant"
                />
              );
            } else {
              return (
                <GhostFrame
                  tooltip={uiT("Add variant to this group")}
                  width={framesWidth}
                  height={framesHeight}
                  onClick={handleAddVariantToGroup(group)}
                  data-event="component-arena-add-variant-to-group"
                />
              );
            }
          }}
          gridEndControls={() => {
            const ghostFrameRef = useRef<GhostFrameRef>(null);

            return (
              <GhostFrame
                ref={ghostFrameRef}
                tooltip={`Add more ${VARIANTS_LOWER}`}
                width={framesWidth}
                height={framesHeight}
                data-event="component-arena-add-variant"
                menu={() => (
                  <Menu onClick={() => ghostFrameRef.current?.closeMenu()}>
                    <Menu.Item onClick={handleAddToggleVariant}>
                      <UiText message={"Add"} />{" "}
                      <strong>
                        <UiText message={"toggle"} />
                      </strong>{" "}
                      <UiText message={"variant"} />
                    </Menu.Item>
                    <Menu.Item onClick={handleAddSingleSelectVariantGroup}>
                      <UiText message={"Add"} />{" "}
                      <strong>
                        <UiText message={"single-select"} />
                      </strong>{" "}
                      <UiText message={"group of variants"} />
                    </Menu.Item>
                    <Menu.Item onClick={handleAddMultiSelectVariantGroup}>
                      <UiText message={"Add"} />{" "}
                      <strong>
                        <UiText message={"multi-select"} />
                      </strong>{" "}
                      <UiText message={"group of variants"} />
                    </Menu.Item>
                    {!isShowingScreenVariantsGroup && (
                      <>
                        <Menu.Divider />
                        <Menu.SubMenu
                          title={
                            <div>
                              <UiText message={"Add"} />{" "}
                              <strong>
                                <UiText message={"screen"} />
                              </strong>{" "}
                              <UiText message={"variant"} />
                            </div>
                          }
                        >
                          {orderedScreenVariants.map((it) => (
                            <Menu.Item
                              key={it.variant.uuid}
                              onClick={async () =>
                                studioCtx.changeUnsafe(() =>
                                  vController?.onClickVariant(it.variant),
                                )
                              }
                            >
                              {it.variant.name}
                            </Menu.Item>
                          ))}
                          {!!orderedScreenVariants.length && <Menu.Divider />}
                          <Menu.Item
                            onClick={() =>
                              studioCtx.switchLeftTab("responsiveness", {
                                highlight: true,
                              })
                            }
                          >
                            <UiText message={"Edit breakpoints"} />
                          </Menu.Item>
                        </Menu.SubMenu>
                      </>
                    )}
                  </Menu>
                )}
              />
            );
          }}
        />
        {allowCombos && (
          <>
            <div className="overflow-hidden">
              <hr
                className={sty.customGridDivider}
                style={{ transform: `scale(${1 / studioCtx.zoom})` }}
              />
            </div>
            <GridFramesLayout
              arena={arena}
              grid={arena.customMatrix}
              onFrameLoad={onFrameLoad}
              makeRowLabel={() => COMBINATIONS_CAP}
              rowEndControls={() => (
                <VariantComboGhostFrame studioCtx={studioCtx} arena={arena} />
              )}
            />
          </>
        )}
      </div>
    );
  },
);

export const VariantComboGhostFrame = observer(
  function VariantComboGhostFrame(props: {
    studioCtx: StudioCtx;
    arena: ComponentArena | PageArena;
  }) {
    const { studioCtx, arena } = props;
    const [visible, setVisible] = React.useState(false);

    const framesHeight = maybe(arena.matrix.rows[0]?.cols[0]?.frame, (frame) =>
      getFrameHeight(frame),
    );
    const framesWidth = arena.matrix.rows[0]?.cols[0]?.frame.width;

    return (
      <Popover
        transitionName=""
        visible={visible}
        onVisibleChange={(v) => setVisible(v)}
        trigger="click"
        placement="right"
        content={() => (
          <VariantComboForm
            site={studioCtx.site}
            component={arena.component}
            onSubmit={(combo) =>
              studioCtx.changeUnsafe(() => {
                if (combo) {
                  const frame = ensureCustomFrameForActivatedVariants(
                    studioCtx.site,
                    arena,
                    new Set(combo),
                  );
                  studioCtx.setStudioFocusOnFrame({ frame: frame });
                  setVisible(false);
                }
              })
            }
          />
        )}
        destroyTooltipOnHide
      >
        <GhostFrame
          tooltip={
            visible ? undefined : "Add artboard for a combination of variants"
          }
          height={framesHeight}
          width={framesWidth}
        />
      </Popover>
    );
  },
);

function VariantComboForm(props: {
  site: Site;
  component: Component;
  onSubmit: (combo: VariantCombo | undefined) => void;
}) {
  const { site, component, onSubmit } = props;
  const [combo, setCombo] = React.useState<VariantCombo>([]);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Form onFinish={() => onSubmit(combo)} layout="inline">
      <Form.Item>
        <VariantComboPicker
          site={site}
          component={component}
          value={combo}
          onChange={(value) => setCombo(value)}
          onDismiss={() => submitButtonRef.current?.focus()}
          autoFocus={true}
          hideBase={true}
        />
      </Form.Item>
      <Form.Item>
        <Button
          ref={submitButtonRef}
          type="primary"
          htmlType="submit"
          size={"small"}
        >
          <UiText message={"Create"} /> {<UiLabel text={FRAME_LOWER} />}
        </Button>
      </Form.Item>
    </Form>
  );
}
