import { getOutlineModelInput, useOutlineModelValue } from "@/wab/client/components/sidebar-tabs/outline-model-inputs";
import { useVariantModelWorld, type VariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";
import { CanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { outlineTabFields } from "@/wab/client/components/sidebar-tabs/outline-tab-inputs";
import { useCanvasComponentValue, useCanvasViewInputs, noCanvasModelFields, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { matchesSelectionTarget, useFocusedViewSelection, useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { revealCanvasElement } from "@/wab/client/components/canvas/canvas-scroll";
import {
  getPreferredInsertLocs,
  InsertRelLoc,
} from "@/wab/client/components/canvas/view-ops";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { PlumyIcon } from "@/wab/client/components/plume/plume-markers";
import {
  variantComboName,
  VariantSettingPopoverContent,
  VariantSettingPopoverTitle,
} from "@/wab/client/components/style-controls/DefinedIndicator";
import Indicator from "@/wab/client/components/style-controls/Indicator";
import { makeTreeNodeMenu } from "@/wab/client/components/tpl-menu";
import { DragItem } from "@/wab/client/components/widgets";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { ListSpace } from "@/wab/client/components/widgets/ListStack";
import MenuButton from "@/wab/client/components/widgets/MenuButton";
import { VirtualListScrollbar } from "@/wab/client/components/widgets/VirtualListScrollbar";
import { focusModelInput } from "@/wab/client/studio-ctx/studio-input";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  EXPANDER_COLLAPSED_ICON,
  EXPANDER_EXPANDED_ICON,
  getVisibilityIcon,
  HIDDEN_ICON,
  iconForTplType,
} from "@/wab/client/icons";
import { renderCantAddMsg } from "@/wab/client/messages/parenting-msgs";
import LockIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Lock";
import UnlockIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Unlock";
import VerticalDashIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__VerticalDash";
import RepeatingsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__RepeatingSvg";
import { DragInsertState, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  getSetOfPinnedVariantsForViewCtx,
  ViewCtx,
} from "@/wab/client/studio-ctx/view-ctx";
import {
  canSetDisplayNone,
  getSlotSelectionDisplayName,
} from "@/wab/client/utils/tpl-client-utils";
import {
  swallowingClick,
  useChanged,
  useForwardedRef,
} from "@/wab/commons/components/ReactUtil";
import {
  AnyArena,
  getArenaFrameDesc,
  getArenaFrames,
  isMixedArena,
} from "@/wab/shared/Arenas";
import {
  assert,
  arrayEq,
  ensure,
  ensureHTMLElt,
  maybe,
  spawn,
  unexpected,
  withoutNils,
} from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { Selectable } from "@/wab/shared/core/selection";
import { isSlotSelection, SlotSelection } from "@/wab/shared/core/slots";
import * as Tpls from "@/wab/shared/core/tpls";
import {
  clone,
  getTplOwnerComponent,
  getTplType,
  isCodeComponentRoot,
  isTplTagOrComponent,
  isTplVariantable,
} from "@/wab/shared/core/tpls";
import {
  bestValForTpl,
  ValComponent,
} from "@/wab/shared/core/val-nodes";
import { asTpl } from "@/wab/shared/core/vals";
import { EffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { CanvasEnv } from "@/wab/shared/eval";
import {
  ArenaFrame,
  Expr,
  isKnownTplNode,
  isKnownTplTag,
  isKnownTplComponent,
  isKnownTplSlot,
  TplNode,
} from "@/wab/shared/model/classes";
import {
  canAddChildrenAndWhy,
  canAddSiblingsAndWhy,
  CantAddChildMsg,
  CantAddSiblingMsg,
} from "@/wab/shared/parenting";
import {
  getPlumeElementDef,
  getPlumeSlotDef,
} from "@/wab/shared/plume/plume-registry";
import {
  getAncestorTplSlot,
  getSlotSelectionContainingTpl,
  isCodeComponentSlot,
  isPlainTextTplSlot,
} from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import {
  isBaseVariant,
  isVariantSettingEmptyExcludingDefaultIgnorableStyles,
} from "@/wab/shared/Variants";
import { TplVisibility } from "@/wab/shared/visibility-utils";
import { selectionControlsColor } from "@/wab/styles/css-variables";
import { Button, notification, Tooltip } from "antd";
import cx from "classnames";
import $ from "jquery";
import L, { isArray } from "lodash";

import * as React from "react";
import { FixedSizeList } from "react-window";
import { createStudioStore } from "@/wab/client/stores/store-kit";
import { useStore } from "zustand";

import { TplClip } from "@/wab/client/clipboard/local";
import { COMMANDS } from "@/wab/client/commands/command";
import CommentIndicatorIcon from "@/wab/client/components/comments/CommentIndicatorIcon";
import { getSubjectVariantsKey } from "@/wab/client/components/comments/utils";
import {
  getNodeSummary,
  makeNodeKey,
  OutlineCtx,
  OutlineNode,
  OutlineNodeData,
  OutlineNodeKey,
} from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { useStructurePanelStyles } from "@/wab/client/components/studio/StructurePanel.styles";
import BoltIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Bolt";
import { transformDataTokensToDisplay } from "@/wab/shared/eval/expression-parser";
import { INTERACTIVE_CAP, REPEATED_CAP } from "@/wab/shared/Labels";
import { FiHash, FiMaximize } from "react-icons/fi";

function RepIcon() {
  const { t: uiT } = useI18n();

  return (
    <Tooltip
      title={uiT("{part1} element", {
        part1: translateUiLabel(getUiLocale(), REPEATED_CAP),
      })}
    >
      <Icon icon={RepeatingsvgIcon} />
    </Tooltip>
  );
}

function ActionIcon() {
  const { t: uiT } = useI18n();

  return (
    <Tooltip
      title={uiT("{part1} element", {
        part1: translateUiLabel(getUiLocale(), INTERACTIVE_CAP),
      })}
    >
      <Icon icon={BoltIcon} />
    </Tooltip>
  );
}

function createOutlineNodePresentation(viewCtx: ViewCtx, item: TplNode | SlotSelection) {
  const component = $$$(item).owningComponent();
  const isFocusedView = viewCtx.studioCtx.selectionStore.getState().view === viewCtx;
  const effectiveVs = (() =>
      isTplTagOrComponent(item)
        ? viewCtx.variantTplMgr().effectiveVariantSetting(item)
        : undefined)();

  const indicatedVs = (() => {
      if (isTplVariantable(item) && isFocusedView) {
        const vtm = viewCtx.variantTplMgr();
        const getRelevantVs = () => {
          if (getAncestorTplSlot(item, true)) {
            // This tpl is a default slot content; only show indicator if we are
            // targeting hte base variant
            if (isBaseVariant(vtm.getCurrentVariantCombo())) {
              return vtm.ensureBaseVariantSetting(item);
            } else {
              return undefined;
            }
          } else {
            return viewCtx.variantTplMgr().tryGetTargetVariantSetting(item);
          }
        };

        const vs = getRelevantVs();
        return !!vs && !isVariantSettingEmptyExcludingDefaultIgnorableStyles(vs)
          ? vs
          : undefined;
      }
      return undefined;
    })();



  const hasRep = (() => {
      if (Tpls.isTplVariantable(item)) {
        const vs = effectiveVs;
        return !!vs && !!vs.dataRep;
      }
      return false;
    })();

  const hasInteraction = (() => {
      if (isKnownTplNode(item)) {
        return Tpls.hasEventHandlers(item);
      }
      return false;
    })();

  const visibilityDataCond = effectiveVs?.dataCond;
  const canvasEnv = isKnownTplNode(item)
    ? viewCtx.getCanvasEnvForTpl(item)
    : undefined;

  const isRoot = isKnownTplNode(item) && !item.parent;

  const getTextContent = function getTextContent(n: TplNode) {
    const text = Tpls.getTplTextBlockContent(n, viewCtx);
    return text
      ? `"${transformDataTokensToDisplay(
          text,
          viewCtx.site,
          viewCtx.siteInfo.id,
        )}"`
      : undefined;
  };

  const customLabel = Tpls.isTplCodeComponent(item) && canvasEnv ? (() => {
    const meta = viewCtx.studioCtx.getCodeComponentMeta(item.component);
    if (meta && (meta as any).treeLabel) { const { componentPropValues, ccContextData } = viewCtx.getComponentEvalContext(item); return (meta as any).treeLabel(componentPropValues, ccContextData); }
    return null;
  })() : null;
  const plumeDef = isKnownTplSlot(item) ? getPlumeSlotDef(component, item.param) : isKnownTplNode(item) ? getPlumeElementDef(component, item) : undefined;
  return Object.freeze({
    commentSubjectId: isKnownTplNode(item) ? item.uuid : undefined,
    commentVariantKey: isKnownTplNode(item) ? getSubjectVariantsKey(item, getSetOfPinnedVariantsForViewCtx(viewCtx, viewCtx.bundler())) : undefined,
    component, effectiveVs, indicatedVs, hasRep, hasInteraction, visibilityDataCond, canvasEnv, isRoot, customLabel, plumeDef,
    name: item instanceof SlotSelection ? "" : isKnownTplSlot(item) ? item.param.variable.name : isKnownTplTag(item) || isKnownTplComponent(item) ? item.name ?? "" : "",
    summary: item instanceof SlotSelection ? "" : getNodeSummary(item, effectiveVs?.rsh()),
    slotSelectionLabel: item instanceof SlotSelection ? getSlotSelectionDisplayName(item, viewCtx) : undefined,
    text: item instanceof SlotSelection ? undefined : getTextContent(item),
    slotText: isKnownTplSlot(item) && isPlainTextTplSlot(item) && !isCodeComponent(component) ? getTextContent(item.defaultContents[0]) : undefined,
    codeComponentRoot: isKnownTplNode(item) && isCodeComponentRoot(item),
    codeComponentSlot: isKnownTplSlot(item) && isCodeComponentSlot(item),
    locked: isKnownTplNode(item) ? item.locked : undefined,
    canToggleVisibility: !(item instanceof SlotSelection) && Tpls.canToggleVisibility(item, viewCtx),
    nodeIcon: createNodeIcon(item, effectiveVs),
  });
}

const TplTreeNodeContent = React.memo(function TplTreeNodeContent(props: {
  presentation: ReturnType<typeof createOutlineNodePresentation>;
  id: OutlineNodeKey;
  item: TplNode | SlotSelection;
  viewCtx: ViewCtx;
  outlineCtx: OutlineCtx;
  indent: number;
  ancestorHidden: boolean;
  ancestorLocked: boolean;
  componentFrameNum: number;
  isOpen: boolean;
  visibility: TplVisibility;
  isHidden: boolean;
  setOpen: (open: boolean) => void;
  isLeaf: boolean;
  parentId: OutlineNodeKey | undefined;
  isDropParent: boolean;
}) {
  const { t: uiT } = useI18n();
  const {
    id,
    item,
    viewCtx,
    outlineCtx,
    indent,
    componentFrameNum,
    isOpen,
    isHidden,
    visibility,
    setOpen,
    isLeaf,
    parentId,
    isDropParent,
  } = props;




  const commentsCtx = useStudioCtx().commentsCtx;
  const commentsPanel = useStudioOverlayState(viewCtx.studioCtx, (state) => state.commentsPanel);
  const { commentSubjectId, commentVariantKey } = props.presentation;
  const subjectCommentStats = useStore(commentsCtx.store, (state) =>
    commentSubjectId
      ? state.commentStatsBySubject.get(commentSubjectId)
      : undefined,
  );
  const variantCommentStats = useStore(commentsCtx.store, (state) =>
    commentVariantKey
      ? state.commentStatsByVariant.get(commentVariantKey)
      : undefined,
  );

  const component = props.presentation.component;
  const itemIdentity = item instanceof SlotSelection ? { tplUid: item.getTpl().uid, paramUid: item.slotParam.uid } : { tplUid: item.uid, paramUid: undefined };
  const isFocusedView = useStudioSelection(viewCtx.studioCtx, (state) => state.view === viewCtx);
  const isFocused = useViewSelection(viewCtx, (state) => isFocusedView && (itemIdentity.paramUid === undefined && state.tpls.some((ref) => ref?.uid === itemIdentity.tplUid) || state.targets.some((target) => matchesSelectionTarget(target, itemIdentity))));
  const defaultEditing = useStore(viewCtx.studioCtx.renamingOnPanelStore, (renaming) => renaming && isFocused);
  const focusedMode = useStudioArena(viewCtx.studioCtx, (state) => state.focusedMode);
  const isHovered = useViewSelection(viewCtx, (state) => matchesSelectionTarget(state.hover, itemIdentity));
  const focusedElsewhere = useStudioSelection(viewCtx.studioCtx, (state) => !!state.view && state.view !== viewCtx);
  const focusedContext = useFocusedViewSelection(viewCtx.studioCtx, (state) => !!state.context);
  const localOutOfContext = useViewSelection(viewCtx, (state) => !!state.context && state.context.component.uid !== component.uid);
  const isOutOfContext = focusedElsewhere && focusedContext || localOutOfContext;
  const isDrilled = useViewSelection(viewCtx, (state) => {
    const context = state.context;
    return !(item instanceof SlotSelection) && !!context && context.tpl.uid === item.uid && !!state.targets[0]?.owners.some((owner) => owner.tpl.uid === context.tpl.uid && owner.fullKey === context.valFullKey);
  });
  const isDrilledDescendant = useViewSelection(viewCtx, (state) => state.context?.component.uid === component.uid);

  const { effectiveVs, indicatedVs, hasRep, hasInteraction, visibilityDataCond, canvasEnv, isRoot, customLabel, plumeDef, codeComponentRoot, codeComponentSlot } = props.presentation;
  const matcher = useStore(outlineCtx.stateStore, (state) => state.matcher);

  const renderExpander = () => {
    if (isLeaf || isRoot) {
      return (
        <div
          className="tpltree__label__expander"
          data-state-isopen={isLeaf ? "false" : "true"}
        />
      );
    } else {
      return (
        <div
          className="tpltree__label__expander"
          onClick={swallowingClick(() => setOpen(!isOpen))}
          data-state-isopen={isOpen ? "true" : "false"}
        >
          {isOpen ? EXPANDER_EXPANDED_ICON : EXPANDER_COLLAPSED_ICON}
        </div>
      );
    }
  };

  const renderVisibilityToggle = () => {
    // Visibility toggle should take up space if showLockIcon is true,
    // so that showLockIcon always shows up at the same column
    if (item instanceof SlotSelection && isHidden) {
      return (
        <Tooltip title={uiT("This prop is currently not visible")}>
          <div
            className={cx({
              "tpltree__label__action-icon": true,
              tpltree__label__visibility: true,
              "tpltree__label__action-icon--visible": true,
              "tpltree__label__action-icon--take-space": showLockIcon,
            })}
          >
            {HIDDEN_ICON}
          </div>
        </Tooltip>
      );
    }
    if (isSlotSelection(item) || !props.presentation.canToggleVisibility) {
      // Can only toggle visibility for tags, components.  But we still want to
      // take up space here so things line up vertically.
      return (
        <div
          className={cx({
            "tpltree__label__action-icon": true,
            "tpltree__label__action-icon--take-space": showLockIcon,
          })}
        />
      );
    }
    return (
      <TplVisibilityToggle
        tpl={item}
        viewCtx={viewCtx}
        visibility={visibility}
        isHidden={isHidden}
        visibilityDataCond={visibilityDataCond}
        canvasEnv={canvasEnv}
        ancestorHidden={props.ancestorHidden}
        takeSpace={showLockIcon}
      />
    );
  };

  const renderLockToggle = () => {
    if (item instanceof SlotSelection) {
      if (props.ancestorLocked) {
        return (
          <Tooltip title={uiT("This prop is currently locked")}>
            <div
              className={cx({
                "tpltree__label__action-icon": true,
                tpltree__label__lock: true,
                "tpltree__label__action-icon--visible": true,
              })}
            >
              <Icon icon={VerticalDashIcon} />
            </div>
          </Tooltip>
        );
      } else {
        // Can only toggle visibility for TplNodes.
        return null;
      }
    }
    return (
      <Tooltip
        title={
          props.presentation.locked || props.ancestorLocked ? (
            <UiText message="Unlock to enable editing from canvas" />
          ) : (
            <UiText message="Lock to disable editing from canvas" />
          )
        }
      >
        <div
          className={cx({
            "tpltree__label__action-icon": true,
            tpltree__label__lock: true,
            "tpltree__label__action-icon--visible": showLockIcon,
          })}
          onClick={swallowingClick(() =>
            viewCtx.change(() => {
              if (item.locked === true) {
                item.locked = null;
              } else if (item.locked === false) {
                item.locked = null;
              } else if (props.ancestorLocked) {
                item.locked = false;
              } else {
                item.locked = true;
                // If focused item became locked, clear focus
                const focusedTpl = viewCtx.focusedTpl();
                const ancestors = focusedTpl
                  ? $$$(focusedTpl).ancestors().toArray()
                  : [];
                if (ancestors.includes(item)) {
                  viewCtx.setStudioFocusBySelectable(null);
                }
              }
            }),
          )}
        >
          {item.locked === true ? (
            <Icon icon={LockIcon} />
          ) : item.locked === false ? (
            <Icon icon={UnlockIcon} />
          ) : props.ancestorLocked ? (
            <Icon icon={VerticalDashIcon} />
          ) : (
            <Icon icon={UnlockIcon} />
          )}
        </div>
      </Tooltip>
    );
  };

  const summarizeTpl = (_node: TplNode) => matcher.boldSnippets(props.presentation.summary);

  const renderRep = () => {
    if (hasRep) {
      return (
        <TplNodeIconWrapper node={item}>
          <RepIcon />
        </TplNodeIconWrapper>
      );
    }
    return null;
  };

  const renderInteractive = () => {
    if (hasInteraction) {
      return (
        <TplNodeIconWrapper node={item}>
          <ActionIcon />
        </TplNodeIconWrapper>
      );
    }
    return null;
  };


  const renderContent = () => {
    if (item instanceof SlotSelection) {
      return (
        <TplTreeNodeLabel
          summary={matcher.boldSnippets(
            props.presentation.slotSelectionLabel ?? "",
          )}
        />
      );
    } else if (!Tpls.isTplNodeNamable(item)) {
      return <TplTreeNodeLabel summary={summarizeTpl(item)} />;
    } else if (Tpls.isTplNamable(item)) {

      const itemName = props.presentation.name;
      return (
        <EditableLabel
          labelFactory={(_props) => (
            <span {..._props} className={"tpltree__nodeLabelContainer"} />
          )}
          value={itemName}
          doubleClickToEdit
          defaultEditing={defaultEditing}
          key={`${defaultEditing}`}
          onAbort={() => viewCtx.studioCtx.endRenamingOnPanel()}
          onEdit={(name) => {
            spawn(
              COMMANDS.element.rename.execute(
                viewCtx.studioCtx,
                {
                  name,
                },
                {
                  tpl: item,
                  viewCtx,
                },
              ),
            );
            viewCtx.studioCtx.endRenamingOnPanel();
          }}
          inputBoxPlaceholder={uiT("Element name")}
          allowEmptyString
        >
          <TplTreeNodeLabel
            name={matcher.boldSnippets(itemName)}
            summary={Tpls.isTplTextBlock(item) ? undefined : summarizeTpl(item)}
            content={matcher.boldSnippets(
              props.presentation.text || "",
            )}
            customLabel={customLabel}
          />
        </EditableLabel>
      );
    } else {
      assert(isKnownTplSlot(item), "Expected item to be a TplSlot");
      const text =
        isPlainTextTplSlot(item) && !isCodeComponent(component)
          ? matcher.boldSnippets(
              props.presentation.slotText || "",
            )
          : undefined;

      return (
        <EditableLabel
          labelFactory={(_props) => (
            <span {..._props} className={"tpltree__nodeLabelContainer"} />
          )}
          value={props.presentation.name}
          doubleClickToEdit={!(codeComponentRoot || codeComponentSlot)}
          defaultEditing={defaultEditing}
          key={`${defaultEditing}`}
          onAbort={() => viewCtx.studioCtx.endRenamingOnPanel()}
          onEdit={(name) => {
            viewCtx.change(() => {
              viewCtx.getViewOps().tryRenameParam(name, item.param);
            });
            viewCtx.studioCtx.endRenamingOnPanel();
          }}
          inputBoxPlaceholder={uiT("Slot name")}
        >
          <TplTreeNodeLabel name={summarizeTpl(item)} content={text} />
        </EditableLabel>
      );
    }
  };


  const getCommentStatsForTpl = () => {
    const commentStatsBySubject = subjectCommentStats;

    if (!commentStatsBySubject) {
      return null;
    }

    const result = {
      commentCount: commentStatsBySubject.commentCount,
      replyCount: commentStatsBySubject.replyCount,
      otherVariantsCount: 0,
    };

    if (focusedMode) {
      const commentStatsByVariant = variantCommentStats;

      if (!commentStatsByVariant) {
        return null;
      }

      result.commentCount = commentStatsByVariant.commentCount;
      result.replyCount = commentStatsByVariant.replyCount;
      result.otherVariantsCount =
        commentStatsBySubject.commentCount - commentStatsByVariant.commentCount;
    }

    return result;
  };

  const icon = (() => {
      if (isKnownTplNode(item) && commentsPanel) {
        const commentStats = getCommentStatsForTpl();
        if (commentStats) {
          return (
            <CommentIndicatorIcon
              commentCount={commentStats.commentCount}
              replyCount={commentStats.replyCount}
              otherVariantsCount={commentStats.otherVariantsCount}
            />
          );
        }
      }

      const node = props.presentation.nodeIcon;
      if (plumeDef) {
        return <PlumyIcon def={plumeDef}>{node}</PlumyIcon>;
      } else {
        return node;
      }
    })();


  const showLockIcon =
    props.ancestorLocked || !L.isNil(props.presentation.locked);

  const visibleChangeCallback = React.useCallback(
    (visible: boolean) => {
      if (visible) {
        viewCtx.tryBlurEditingText();
      }
    },
    [viewCtx],
  );

  return (
    <div
      key={id}
      className={cx({
        tpltree__label: true,
        "tpltree__label--focused": isFocused,
        "tpltree__label--out-of-context": isOutOfContext,
        "tpltree__label--hidden": isHidden || props.ancestorHidden,
        "tpltree__label--drilled": isDrilled,
        "tpltree__label--drilled-descendant": isDrilledDescendant,
        "tpltree__label--hovered": isHovered && !isDropParent,
      })}
      data-test-id={`tpltree-${id}`}
      data-test-parent-id={`tpltree-${parentId}`}
      style={{
        paddingLeft: indentPadding(indent),
      }}
      onClick={async (e) => {
        e.stopPropagation();
        const freestyleState = viewCtx.studioCtx.freestyleState();
        const dragInsertState = viewCtx.studioCtx.dragInsertState();
        if (freestyleState || dragInsertState) {
          const loc = L.head(getPreferredInsertLocs(viewCtx, item));
          const state = freestyleState ?? (dragInsertState as DragInsertState);
          const extraInfo = state.spec.asyncExtraInfo
            ? await state.spec.asyncExtraInfo(viewCtx.studioCtx)
            : undefined;
          if (extraInfo === false) {
            return;
          }
          await viewCtx.studioCtx.changeUnsafe(() => {
            if (loc) {
              viewCtx
                .getViewOps()
                .tryInsertInsertableSpec(state.spec, loc, extraInfo, item);
            }
            viewCtx.studioCtx.setFreestyleState(undefined);
            viewCtx.studioCtx.setDragInsertState(undefined);
          });
          return;
        }
        viewCtx.change(() => {
          if (item instanceof SlotSelection) {
            const tplComponent = ensure(
              item.toTplSlotSelection().tpl,
              "SlotSelection in tpl-tree is expected to have a tpl",
            );
            const val = tryGetValForTpl(
              viewCtx,
              tplComponent,
              componentFrameNum,
            );
            const valSlotPlaceholder = new SlotSelection({
              val: val ? (val as ValComponent) : undefined,
              tpl: !val ? tplComponent : undefined,
              slotParam: item.slotParam,
            });
            if (val) {
              viewCtx.getViewOps().tryFocusObj(valSlotPlaceholder, {
                allowLocked: true,
                exact: true,
              });
            } else {
              viewCtx.setStudioFocusBySelectable(valSlotPlaceholder);
            }
          } else {
            // Each tpl can map to multiple vals.  We try to see the "best"
            // corresponding val we can use; see tryGetValForTpl() for what
            // "best" means.
            const val = tryGetValForTpl(viewCtx, item, componentFrameNum);
            if (val) {
              viewCtx.getViewOps().tryFocusObj(val, {
                allowLocked: true,
                appendToMultiSelection: e.shiftKey,
                exact: true,
              });
            } else {
              viewCtx.setStudioFocusByTpl(item, undefined, {
                appendToMultiSelection: e.shiftKey,
              });
            }
          }
          const element = L.last(viewCtx.focusedDomElts())?.[0];
          if (element) {
            revealCanvasElement(element);
          }
        });
      }}
      onContextMenu={(e) => {
        if (!isOutOfContext) {
          viewCtx.tryBlurEditingText();
          maybeShowContextMenu(e.nativeEvent, makeTreeNodeMenu(viewCtx, item));
        }
      }}
      onMouseEnter={() => {
        let val: Selectable | undefined;
        if (viewCtx.focusedSelectable()) {
          val = tryGetValForTpl(viewCtx, item, componentFrameNum);
        } else if (isKnownTplNode(item)) {
          // tryGetValForTpl requires a current selection to work.  If there is none,
          // then we fall back to just taking any val that maps to this tpl, as long as
          // it is within the current context
          const vals = viewCtx.maybeTpl2ValsInContext(item);
          if (vals.length > 0) {
            val = vals[0];
          }
        }
        if (val) {
          const obj = val;
          viewCtx.change(() =>
            viewCtx
              .getViewOps()
              .tryHoverObj(obj, { allowLocked: true, exact: true }),
          );
        }
      }}
      onMouseLeave={() => {
        viewCtx.change(() =>
          viewCtx.getViewOps().tryHoverObj(undefined, { exact: true }),
        );
      }}
    >
      {renderExpander()}
      <div className="tpltree__label__content">
        <TplNodeIconWrapper isFocused={isFocused} node={item}>
          {icon}
        </TplNodeIconWrapper>
        {!codeComponentRoot && !codeComponentSlot && (
          <>
            {renderRep()}
            {renderInteractive()}
          </>
        )}
        {renderContent()}
      </div>
      {!codeComponentRoot && renderLockToggle()}
      {!codeComponentRoot && !codeComponentSlot && renderVisibilityToggle()}
      {!codeComponentRoot && !codeComponentSlot && (
        <MenuButton
          className={"tpltree__label__menu"}
          aria-label={uiT("Outline item menu")}
          align={{ points: ["tl", "tr"], offset: [4, 0] }}
          menu={
            isOutOfContext ? undefined : () => makeTreeNodeMenu(viewCtx, item)
          }
          onVisibleChange={visibleChangeCallback}
        />
      )}
      {
        <div
          className={"tpltree__label__indicator"}
          data-test-class="left-panel-indicator"
          style={{ left: indentPadding(indent) + (isLeaf || isRoot ? 4 : -12) }}
        >
          {indicatedVs && (
            <Indicator
              color={`var(${selectionControlsColor})`}
              popover={() => (
                <VariantSettingPopoverContent
                  site={viewCtx.site}
                  tpl={item as TplNode}
                  vs={indicatedVs}
                  viewCtx={viewCtx}
                />
              )}
              popoverTitle={() => (
                <VariantSettingPopoverTitle vs={indicatedVs} viewCtx={viewCtx}>
                  <UiText
                    message={
                      indicatedVs.variants.length === 1
                        ? 'Settings for variant "{name}"'
                        : 'Settings for variants "{name}"'
                    }
                    values={{ name: variantComboName(indicatedVs.variants) }}
                  />
                </VariantSettingPopoverTitle>
              )}
              placement="right"
            />
          )}
        </div>
      }
    </div>
  );
});

const TplTreeNode = React.memo(function TplTreeNode(props: Omit<React.ComponentProps<typeof TplTreeNodeContent>, "presentation">) {
  const select = React.useCallback(() => createOutlineNodePresentation(props.viewCtx, props.item), [props.viewCtx, props.item]);
  const presentation = useOutlineModelValue(props.viewCtx, select);
  if (!presentation || props.viewCtx.disposeSignal.aborted || props.viewCtx.isDisposed) { return null; }
  if (!props.viewCtx.componentStackFrames().some((frame) => frame.tplComponent.component === presentation.component)) { return null; }
  return <TplTreeNodeContent {...props} presentation={presentation} />;
});

const DraggableTreeNode = React.memo(function DraggableTreeNode(props: {
  id: OutlineNodeKey;
  item: TplNode | SlotSelection;
  dndManager: TreeDndManager;
  viewCtx: ViewCtx;
  isOpen: boolean;
  isLeaf?: boolean;
  children?: React.ReactNode;
  indent: number;
  setOpen: (open: boolean) => void;
  style?: React.CSSProperties;
}) {
  const {
    id,
    item,
    dndManager,
    viewCtx,
    children,
    isOpen,
    isLeaf,
    setOpen,
    indent,
    style,
  } = props;

  const lifetime = useCanvasViewInputs(viewCtx, noCanvasModelFields);
  const insertionMarker = useStore(dndManager.store, () => lifetime.alive ? dndManager.getInsertionMarker(item) : undefined);
  const insertion = maybe(insertionMarker, (x) => x.insertion);
  const insertionRef = React.useRef<DragInsertion | undefined>(insertion);
  const isOpenRef = React.useRef<boolean>(isOpen);
  const isDropParent = useStore(dndManager.store, () => dndManager.isDropParent(item));
  const [labelTarget, setLabelTarget] = React.useState<HTMLElement>();

  React.useEffect(() => {
    insertionRef.current = insertion;
    isOpenRef.current = isOpen;
    // If we can expand, then expand after hovering for 500ms
    if (lifetime.alive && insertion === "insert-as-child" && !isOpen && !isLeaf) {
      const timerId = setTimeout(() => {
        if (!viewCtx.disposeSignal.aborted && insertion === insertionRef.current && !isOpenRef.current) {
          setOpen(true);
        }
      }, 500);
      return () => clearTimeout(timerId);
    }
    return undefined;
  }, [insertion, isOpen, isLeaf, setOpen, viewCtx, lifetime.alive]);

  if (!lifetime.alive) { return null; }

  return (
    <DragItem
      onDragStart={(e) => {
        if (item instanceof SlotSelection || isFixedSlotRoot(viewCtx, item)) {
          e.mouseEvent.stopPropagation();
          e.mouseEvent.preventDefault();
          return false;
        }
        setLabelTarget(
          $(ensureHTMLElt(e.mouseEvent.target))
            .parents(".tpltree__draggable")
            .get(0) as HTMLElement,
        );

        const dragTpls = viewCtx.focusedTpls().some((tpl) => tpl === item)
          ? Tpls.prepareFocusedTpls(viewCtx.focusedTpls())
          : [item];
        const dragClips = dragTpls.map((tpl) =>
          viewCtx.getViewOps().createTplClip(tpl, $$$(tpl).owningComponent()),
        );

        return dndManager.onDragStart(e.mouseEvent, dragClips);
      }}
      onDragEnd={(e) => {
        if (!e.data.aborted) {
          dndManager.onDrop(e.mouseEvent);
        }
        dndManager.onDragEnd();
        setLabelTarget(undefined);
      }}
      dragHandle={() => <DraggedHandle key={id} labelTarget={labelTarget} />}
    >
      <div
        className="tpltree__draggable"
        style={style}
        onMouseEnter={(e) => {
          dndManager.onDragEnter(e);
        }}
        onMouseLeave={(e) => {
          if (dndManager.draggedItems.length) {
            dndManager.onDragLeave(e);
          }
        }}
        onMouseOver={(e) => {
          if (dndManager.draggedItems.length) {
            dndManager.onDragOver(e, item, viewCtx, isOpen && !isLeaf, indent);
          }
        }}
        data-test-id={`tpltree-draggable-${id}`}
      >
        {children}
        {isDropParent && (
          <div className="tpltree__drop-container">
            <div className="tpltree__drop tpltree__drop--dnd-parent" />
          </div>
        )}
        {insertion && (
          <div
            className="tpltree__drop-container"
            style={{
              paddingLeft: indentPadding(
                ensure(
                  insertionMarker,
                  "Expected insertionMarker to be not null",
                ).indent + 1,
              ),
            }}
          >
            <div
              className={cx({
                tpltree__drop: true,
                "tpltree__drop--dnd-above": insertion === "insert-above",
                "tpltree__drop--dnd-below": insertion === "insert-below",
                "tpltree__drop--dnd-parent--error":
                  isCantDragInsertion(insertion) &&
                  insertion.type === "cant-insert-child",
                "tpltree__drop--dnd-above--error":
                  isCantDragInsertion(insertion) &&
                  insertion.type === "cant-insert-above",
                "tpltree__drop--dnd-below--error":
                  isCantDragInsertion(insertion) &&
                  insertion.type === "cant-insert-below",
              })}
            >
              {isCantDragInsertion(insertion) && (
                <div className="tpltree__drop__error">
                  {insertion.msg === false
                    ? ""
                    : renderCantAddMsg(insertion.msg)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DragItem>
  );
});

interface DraggedHandleProps {
  labelTarget?: HTMLElement;
}

function DraggedHandle({ labelTarget }: DraggedHandleProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (labelTarget && ref.current) {
      const label = $(".tpltree__label__content", labelTarget)[0].cloneNode(
        true,
      ) as HTMLDivElement;
      label.classList.add("tpltree__dragged__label");
      ref.current.appendChild(label);
    }
    return () => {
      $(".tpltree__dragged__label").remove();
    };
  }, [labelTarget, ref]);
  return <div className="tpltree__dragged" ref={ref} />;
}

function TplTreeNodeLabel(props: {
  name?: React.ReactNode;
  customLabel?: React.ReactNode;
  summary?: React.ReactNode;
  content?: React.ReactNode;
}) {
  const { name, summary, content, customLabel } = props;
  return (
    <div
      className={cx({
        tpltree__nodeLabel: true,
        "tpltree__nodeLabel--hasName": !!name,
      })}
    >
      {name && <span className="tpltree__nodeLabel__name">{name}</span>}
      {name && customLabel && (
        <span className="tpltree__nodeLabel__customLabel">({customLabel})</span>
      )}
      {summary && (
        <span className="tpltree__nodeLabel__summary">{summary}</span>
      )}
      {!name && customLabel && (
        <span className="tpltree__nodeLabel__customLabel">({customLabel})</span>
      )}
      {content && (
        <span className="tpltree__nodeLabel__content">{content}</span>
      )}
    </div>
  );
}

export function TplNodeIconWrapper(props: {
  node: TplNode | SlotSelection;
  isFocused?: boolean;
  children?: React.ReactNode;
}) {
  const { node, isFocused, children } = props;

  return (
    <div
      className={cx({
        tpltree__label__icon: true,
        "tpltree__label__icon--focused": isFocused,
        "tpltree__label__icon--component": Tpls.isTplComponent(node),
        "tpltree__label__icon--tag": Tpls.isTplTag(node),
        "tpltree__label__icon--slot": Tpls.isTplSlot(node),
        "tpltree__label__icon--prop": node instanceof SlotSelection,
      })}
    >
      {children}
    </div>
  );
}

export function createNodeIcon(
  node: TplNode | SlotSelection,
  vs?: EffectiveVariantSetting,
) {
  return <Icon icon={iconForTplType(getTplType(node, vs))} />;
}

function tryGetValForTpl(
  viewCtx: ViewCtx,
  tplToSelect: TplNode | SlotSelection,
  frameNum: number,
) {
  // A Tpl can map to multiple Vals (or none).  Normally we try to
  // just select the first Val.  But we can be smarter in some
  // situations.  If we already have selected a Val, and we select a
  // Tpl higher up above it (an ancestor), we can make sure to
  // select the corresponding Val on that Val ancestor path.
  //
  // TODO We also want to do the same in the opposite (downward)
  // direction---if you select a descendant, scope to the subtree of
  // the currently selected Val.
  //
  // TODO Most generally---even if we choose a Tpl that is neither
  // an ancestor nor descendant, we can still scope to the smallest
  // Val neighborhood.  E.g., with this Tpl tree:
  //
  // TODO extract this out into shared code so that this selection
  // refinement can appear wherever we are selecting by tpl
  //
  // - A
  //     - B (repeated)
  //         - C <-- currently selected
  //         - D <-- new selection
  //
  // with this Val tree:
  //
  // - A0 (tpl: A)
  //     - B0 (tpl: B)
  //         - C0 (tpl: C)
  //         - D0 (tpl: D)
  //     - B1 (tpl: B)
  //         - C0 (tpl: C) <-- currently selected
  //         - D0 (tpl: D) <-- new selection
  //
  // we want to select the second D, not the first D!
  const initialSel = viewCtx.focusedSelectable();
  if (!initialSel) {
    return undefined;
  }
  if (initialSel instanceof SlotSelection && !initialSel.val) {
    // This is a SlotSelection of a hidden TplComponent.
    return undefined;
  }
  return bestValForTpl(
    tplToSelect,
    frameNum,
    viewCtx.valState(),
    initialSel,
    viewCtx.tplUserRoot(),
  );
}

type CantAddTreeSiblingMsg = CantAddSiblingMsg | false;
type CantAddTreeChildMsg = CantAddChildMsg | false;
type DragInsertion =
  | "insert-above"
  | "insert-below"
  | "insert-as-child"
  | { type: "cant-insert-above"; msg: CantAddTreeSiblingMsg }
  | { type: "cant-insert-below"; msg: CantAddTreeSiblingMsg }
  | { type: "cant-insert-child"; msg: CantAddTreeChildMsg };

function isCantDragInsertion(
  ins: DragInsertion,
): ins is Exclude<
  DragInsertion,
  "insert-above" | "insert-below" | "insert-as-child"
> {
  return !L.isString(ins);
}

function getTargetSlivers(
  e: React.DragEvent | React.MouseEvent,
  acceptsChildren?: boolean,
) {
  const targetRect = e.currentTarget.getBoundingClientRect();

  const sliver = targetRect.height / (acceptsChildren === true ? 4 : 2);

  const isTopSliver = () => {
    return e.clientY <= targetRect.top + sliver;
  };

  const isBottomSliver = () => {
    const bottom = targetRect.top + targetRect.height;
    return e.clientY >= bottom - sliver;
  };

  return {
    topSliver: isTopSliver(),
    bottomSliver: isBottomSliver(),
  };
}

type InsertionOutcome = {
  insertion: DragInsertion;
  item: TplNode | SlotSelection;
  marker: {
    item: TplNode | SlotSelection;
    indent: number;
    insertion: DragInsertion;
  };
};

/**
 * Helper class for managing state when drag-and-drop tpl-tree nodes
 */
export class TreeDndManager {
  private initialPos: { clientX: number; clientY: number } | undefined;
  draggedItems: TplClip[] = [];
  target:
    | {
        viewCtx: ViewCtx;
        outcome: InsertionOutcome;
      }
    | undefined = undefined;

  /** Native drag commands publish a version after updating their plain fields. */
  readonly store = createStudioStore<{ version: number }>(() => ({ version: 0 }), {
    name: "studio-tpl-tree-dnd",
  });

  constructor(private studioCtx: StudioCtx) {}

  private bump() {
    this.store.setState({ version: this.store.getState().version + 1 });
  }

  setDraggedItems(items: TplClip[]) {
    this.draggedItems = items;
    this.bump();
  }

  setTarget(
    target: { viewCtx: ViewCtx; outcome: InsertionOutcome } | undefined,
  ) {
    this.target = target;
    this.bump();
  }

  isDraggedNode = (item: TplNode | SlotSelection) => {
    if (item instanceof SlotSelection) {
      return false;
    }
    return this.draggedItems.find((draggedItem) => draggedItem.node === item);
  };

  isDropTarget = (item: TplNode | SlotSelection) => {
    if (!this.target) {
      return false;
    }
    return this.target.outcome.item === item;
  };

  getInsertionMarker = (item: TplNode | SlotSelection) => {
    if (!this.target) {
      return undefined;
    }

    return this.target.outcome.marker.item === item
      ? this.target.outcome.marker
      : undefined;
  };

  isDropParent = (item: TplNode | SlotSelection) => {
    if (!this.target) {
      return false;
    }
    if (isCantDragInsertion(this.target.outcome.insertion)) {
      return false;
    }
    const ins = this.target.outcome.insertion;
    if (ins === "insert-as-child") {
      return this.target.outcome.item === item;
    } else {
      // inserting as sibling, so check if `item` is a parent of `target.item`
      if (isKnownTplNode(this.target.outcome.item)) {
        const parent = this.target.outcome.item.parent;
        if (Tpls.isTplComponent(parent)) {
          const sel = ensure(
            getSlotSelectionContainingTpl(this.target.outcome.item),
            "Child of tplComponent is expected to have a slot selection",
          );
          return (
            item instanceof SlotSelection &&
            item.slotParam === sel.slotParam &&
            item.getTpl() === sel.getTpl()
          );
        } else if (parent) {
          if (parent === item) {
            return true;
          }
        }
      }
      return false;
    }
  };

  onDragStart(
    e: Pick<MouseEvent, "preventDefault" | "clientX" | "clientY">,
    items: TplClip[],
  ) {
    if (
      items.some(
        (item) =>
          !(isTplTagOrComponent(item.node) || Tpls.isTplSlot(item.node)) ||
          Tpls.isTplTextBlock(item.node.parent),
      )
    ) {
      e.preventDefault();
      return false;
    }

    this.setDraggedItems(items);
    this.initialPos = {
      clientX: e.clientX,
      clientY: e.clientY,
    };
    return true;
  }

  /**
   * Called when dragging over a tree node.  cleanup() will be called when this
   * tree node is no longer being targeted.  Returns undefined if no
   * appropriate
   * insertion for `item`, or both proposed insertion as well as the timestamp
   * from when the insertion was first proposed.  Using the timestamp allows
   * you to check if the user has been hovering over the same item for some
   * time.
   */
  onDragOver(
    e: React.MouseEvent,
    item: TplNode | SlotSelection,
    viewCtx: ViewCtx,
    childrenShowing: boolean,
    indent: number,
  ) {
    e.preventDefault();
    const insertion = this.getInsertion(e, item, childrenShowing, indent);
    if (insertion) {
      // Save the new target.  This is so that in onDragEnd(), we can do the
      // actual drop.
      this.setTarget({
        viewCtx,
        outcome: insertion,
      });
    }
  }

  onDragEnter(e: React.DragEvent | React.MouseEvent) {
    e.preventDefault();
  }

  onDragLeave(e: React.DragEvent | React.MouseEvent) {
    e.preventDefault();
  }

  onDrop(e: Pick<MouseEvent, "preventDefault" | "stopPropagation">) {
    // We rely on onDrop, because if the user cancels the drag (by hitting ESC),
    // then onDrop is not called, though onDragEnd is.
    e.preventDefault();
    // Stop propagation, so the outline panel doesn't also handle the drop
    e.stopPropagation();

    const target = this.target;
    if (!target) {
      return;
    }
    // If there's a tentative insertion, then perform this now.
    const insertion = target.outcome.insertion;
    if (isCantDragInsertion(insertion)) {
      return;
    }

    if (this.draggedItems.length === 0) {
      return;
    }

    const targetItem = target.outcome.item;
    if (this.draggedItems.some((item) => targetItem === item.node)) {
      return;
    }

    if (this.draggedItems.some((item) => item.node.parent == null)) {
      notification.warning({
        message: translate(getUiLocale(), "The root node is not movable"),
      });
      return;
    }

    const sameTree =
      this.draggedItems[0].component ===
      getTplOwnerComponent(asTpl(targetItem));
    const relLoc =
      insertion === "insert-above"
        ? InsertRelLoc.before
        : insertion === "insert-below"
          ? InsertRelLoc.after
          : insertion === "insert-as-child"
            ? InsertRelLoc.append
            : unexpected();
    if (relLoc === InsertRelLoc.after) {
      // Reverse items in-place to insert in the expected order.
      this.draggedItems.reverse();
    }

    target.viewCtx.change(() => {
      const insertedNodes: TplNode[] = [];
      for (const tplClip of this.draggedItems) {
        if (sameTree) {
          const hasInserted = target.viewCtx
            .getViewOps()
            .tryInsertAt(tplClip.node, undefined, relLoc, targetItem);
          if (hasInserted) {
            insertedNodes.push(tplClip.node);
          }
        } else {
          const pastedNode = target.viewCtx.getViewOps().pasteTplClip({
            clip: {
              ...tplClip,
              node:
                // Only need to clone if moving across components.  Minimize
                // changes by keeping same-component re-parenting a lightweight
                // operation.
                sameTree ? tplClip.node : clone(tplClip.node),
            },
            target: targetItem,
            loc: relLoc,
          });
          if (pastedNode) {
            if (isArray(pastedNode)) {
              insertedNodes.push(...pastedNode);
            } else {
              insertedNodes.push(pastedNode);
            }
          }
          $$$(tplClip.node).remove({ deep: true });
        }
      }
      this.studioCtx.setStudioFocusOnViewCtxContent(target.viewCtx);
      target.viewCtx.selectNewTpls(insertedNodes);

      // Call onDragEnd explicitly to clean up, since performing onDrop may
      // mean removing the element that has the onDragEnd handler attached,
      // and we may never get a chance to clean up otherwise.
      this.onDragEnd();
    });
  }

  onDragEnd() {
    this.setTarget(undefined);
    this.setDraggedItems([]);
    this.initialPos = undefined;
  }

  private getDedentedInsertion(
    e: React.DragEvent | React.MouseEvent,
    item: TplNode | SlotSelection,
    indent: number,
  ): InsertionOutcome | undefined {
    const THRESHOLD = 20;
    if (item instanceof SlotSelection) {
      return undefined;
    }
    if (!this.draggedItems.length) {
      return undefined;
    }
    const draggedNodes = this.draggedItems.map((dragged) => dragged.node);
    let xDelta =
      e.clientX -
      ensure(this.initialPos, "Expected initialPos to be not nullish").clientX;
    if (
      xDelta < -THRESHOLD &&
      (draggedNodes.includes(item) || getTargetSlivers(e, false).bottomSliver)
    ) {
      // The user has moved leftward, so we should try to do a "dedented" insert if possible
      const canInsertAsTargetParentSibling = (target: TplNode) => {
        const parent = target.parent;
        if (!parent) {
          return false;
        }
        if (Tpls.isTplTag(parent)) {
          return (
            L.last(parent.children) === target &&
            draggedNodes.every((dragged) =>
              canAddSiblingsAndWhy(parent, dragged),
            )
          );
        } else if (Tpls.isTplSlot(parent)) {
          return (
            L.last(parent.defaultContents) === target &&
            draggedNodes.every((dragged) =>
              canAddSiblingsAndWhy(parent, dragged),
            )
          );
        } else {
          return false;
        }
      };
      let newTarget = item;
      while (xDelta < -THRESHOLD && canInsertAsTargetParentSibling(newTarget)) {
        newTarget = ensure(
          newTarget.parent,
          "Expected newTarget to have a parent",
        );
        indent -= 1;
        xDelta += THRESHOLD;
      }
      if (newTarget === item) {
        return undefined;
      }
      return {
        item: newTarget,
        insertion: "insert-below",
        marker: {
          item,
          insertion: "insert-below",
          indent,
        },
      };
    }
    return undefined;
  }

  /**
   * Compute DragInsertion against target `item`
   */
  private getInsertion(
    e: React.DragEvent | React.MouseEvent,
    item: TplNode | SlotSelection,
    childrenShowing: boolean,
    indent: number,
  ): InsertionOutcome | undefined {
    if (!this.draggedItems.length) {
      return undefined;
    }

    const dedented = this.getDedentedInsertion(e, item, indent);
    if (dedented) {
      return dedented;
    }

    const draggedNodes = this.draggedItems.map((dragged) => dragged.node);
    const { acceptsChildren, acceptsSibling } = this.getAcceptance(
      draggedNodes,
      item,
    );

    const targetSlivers = getTargetSlivers(e, acceptsChildren === true);

    const isAbove = targetSlivers.topSliver;
    const isBelow = !childrenShowing && targetSlivers.bottomSliver;

    let insertion: DragInsertion | undefined;
    if (acceptsSibling === true && isAbove) {
      insertion = "insert-above";
    } else if (acceptsSibling === true && isBelow) {
      // We allow inserting below if no children are being rendered.  Otherwise,
      // if children are rendered, then the bottom sliver of this node is not
      // really the "bottom", as children will come below this.
      insertion = "insert-below";
    } else if (acceptsChildren === true) {
      insertion = "insert-as-child";
    } else if (
      !(item instanceof SlotSelection) &&
      acceptsSibling !== true &&
      (isAbove || isBelow)
    ) {
      insertion = {
        type: isAbove ? "cant-insert-above" : "cant-insert-below",
        msg: acceptsSibling,
      };
    } else if (!childrenShowing) {
      insertion = {
        type: "cant-insert-child",
        msg: acceptsChildren,
      };
    }

    if (insertion) {
      return {
        item,
        insertion,
        marker: {
          item,
          insertion,
          indent,
        },
      };
    } else {
      return undefined;
    }
  }

  private getAcceptance(
    draggedNodes: TplNode[],
    target: TplNode | SlotSelection,
  ) {
    return {
      acceptsChildren:
        draggedNodes
          .map((dragged) => canAddChildrenAndWhy(target, dragged))
          .find((why) => why !== true) ?? true,
      acceptsSibling:
        draggedNodes
          .map((dragged) => canAddSiblingsAndWhy(target, dragged))
          .find((why) => why !== true) ?? true,
    };
  }
}

function indentPadding(indent: number) {
  // Reserve a gutter for the configuration indicator before the tree controls.
  return 16 + indent * 12;
}

export type OutlineTreeRow =
  | { type: "artboard"; key: string; indent: number; frame: ArenaFrame }
  | {
      type: "node";
      key: string;
      indent: number;
      node: OutlineNodeData & { readonly isOpen: boolean };
      outlineCtx: OutlineCtx;
    };

interface TreeRowItemData {
  nodes: readonly OutlineTreeRow[];
  outlineCtx: OutlineCtx;
  dndManager: TreeDndManager;
  studioCtx: StudioCtx;
}

const OutlineLayerRow = React.memo(function OutlineLayerRow(props: {
  node: OutlineNodeData & { readonly isOpen: boolean };
  outlineCtx: OutlineCtx;
  dndManager: TreeDndManager;
  style?: React.CSSProperties;
}) {
  const { node, outlineCtx, dndManager, style } = props;
  const viewCtx = ensure(outlineCtx.viewCtx(), "ViewCtx missing");
  const lifetime = useCanvasViewInputs(viewCtx, noCanvasModelFields);
  const isOpen = node.isOpen;
  const setOpen = React.useCallback(
    (open: boolean) => outlineCtx.setExpanded(node.key, open),
    [outlineCtx, node.key],
  );
  const isDropParent = useStore(dndManager.store, () => dndManager.isDropParent(node.item));
  if (!lifetime.alive) { return null; }
  return (
    <DraggableTreeNode
      id={node.key}
      item={node.item}
      dndManager={dndManager}
      viewCtx={viewCtx}
      isOpen={isOpen}
      isLeaf={node.isLeaf}
      indent={node.indent}
      setOpen={setOpen}
      style={style}
    >
      <TplTreeNode
        id={node.key}
        viewCtx={viewCtx}
        outlineCtx={outlineCtx}
        isOpen={isOpen}
        visibility={node.visibility}
        isHidden={node.isHidden}
        setOpen={setOpen}
        item={node.item}
        indent={node.indent}
        ancestorHidden={node.ancestorHidden}
        componentFrameNum={node.componentFrameNum}
        isLeaf={node.isLeaf}
        ancestorLocked={node.ancestorLocked}
        parentId={node.parentKey}
        isDropParent={isDropParent}
      />
    </DraggableTreeNode>
  );
});

const ArtboardOutlineRow = React.memo(function ArtboardOutlineRow(props: {
  frame: ArenaFrame;
  outlineCtx: OutlineCtx;
  studioCtx: StudioCtx;
  style?: React.CSSProperties;
}) {
  const { frame, outlineCtx, studioCtx, style } = props;
  const selectedView = useStudioSelection(studioCtx, (state) => state.view);
  const { styles } = useStructurePanelStyles();
  const { t } = useI18n();
  const arenaRef = useStudioArena(studioCtx, (state) => state.frames.some((ref) => studioCtx.modelSnapshots.resolve(ref) === frame) ? state.current : null);
  const arena = arenaRef ? studioCtx.modelSnapshots.resolve(arenaRef) : null;
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => outlineTabFields(studioCtx.site, arena, field), [studioCtx, arena]);
  const readLabel = React.useCallback(() => arena ? getArenaFrameDesc(arena, frame, studioCtx.site) : undefined, [studioCtx, arena, frame]);
  const label = useCanvasComponentValue(studioCtx, frame, recipe, readLabel);
  const expanded = useStore(outlineCtx.stateStore, (state) => state.expandedFrames.get(frame) ?? false);
  if (!arena || label === undefined) { return null; }
  return (
    <div className={styles.artboardRow} style={style}>
      <button
        type="button"
        className={styles.artboardToggle}
        aria-label={label}
        aria-expanded={expanded}
        onClick={() => outlineCtx.setFrameExpanded(frame, !expanded)}
      >
        {expanded ? EXPANDER_EXPANDED_ICON : EXPANDER_COLLAPSED_ICON}
      </button>
      <button
        type="button"
        className={styles.artboardLabel}
        aria-current={selectedView?.arenaFrame() === frame}
        title={label}
        onClick={() => {
          outlineCtx.setFrameExpanded(frame, true);
          void studioCtx.changeUnsafe(() =>
            studioCtx.setStudioFocusOnFrame({ frame, autoZoom: false }),
          );
        }}
      >
        <FiHash size={14} />
        <span>{label}</span>
      </button>
      <Button
        type="text"
        className={styles.iconButton}
        aria-label={`${t("Focus artboard")}: ${label}`}
        title={t("Focus artboard")}
        icon={<FiMaximize size={14} />}
        onClick={() => {
          outlineCtx.setFrameExpanded(frame, true);
          studioCtx.focusCanvasFrame(frame);
        }}
      />
    </div>
  );
});

const ArenaTreeNode = function ArenaTreeNode(props: {
  index: number;
  data: TreeRowItemData;
  style?: React.CSSProperties;
}) {
  const { index, data, style } = props;
  const row = data.nodes[index];
  return row.type === "artboard" ? (
    <ArtboardOutlineRow
      frame={row.frame}
      outlineCtx={data.outlineCtx}
      studioCtx={data.studioCtx}
      style={style}
    />
  ) : (
    <OutlineLayerRow
      node={row.node}
      outlineCtx={row.outlineCtx}
      dndManager={data.dndManager}
      style={style}
    />
  );
};

export type ArenaTreeRef = FixedSizeList;

// react-window positions rows absolutely, so overflowing row contents cannot
// size the inner element. Give every row the same scrollable width, including
// rows that are currently outside the virtualized viewport.
const OutlineTreeInner = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function OutlineTreeInner({ style, ...props }, ref) {
  return (
    <div
      {...props}
      ref={ref}
      style={{
        ...style,
        position: "relative",
        minWidth: "var(--outline-tree-min-width)",
      }}
    />
  );
});

const OutlineScrollbar = React.forwardRef<HTMLElement, React.ComponentProps<typeof VirtualListScrollbar>>(
  function OutlineScrollbar(props, ref) {
    return <VirtualListScrollbar {...props} ref={ref} tabIndex={-1} data-studio-model-input
      onPointerDownCapture={event => focusModelInput(event.currentTarget, event.target)} />;
  },
);

export const ArenaTree = React.memo(
  React.forwardRef(function ArenaTree(
    props: {
      studioCtx: StudioCtx;
      arena: AnyArena | null;
      outlineCtx: OutlineCtx;
      dndManager: TreeDndManager;
    },
    outerRef: React.Ref<ArenaTreeRef>,
  ) {
    const { studioCtx, arena, outlineCtx, dndManager } = props;
    const { ref: listRef, onRef } = useForwardedRef(outerRef);

    const { visibleNodes, focusedKey } = useTreeData(
      studioCtx,
      arena,
      outlineCtx,
    );

    const getKeyIndex = React.useCallback(
      (key: string) => visibleNodes.findIndex((row) => row.key === key),
      [visibleNodes],
    );
    useRevealOnFocus({ listRef, getKeyIndex, focusedKey });

    const itemData: TreeRowItemData = React.useMemo(
      () => ({
        outlineCtx,
        dndManager,
        nodes: visibleNodes,
        studioCtx,
      }),
      [outlineCtx, dndManager, visibleNodes, studioCtx],
    );
    const itemKey = React.useCallback(
      (index: number, data: TreeRowItemData) => data.nodes[index].key,
      [],
    );

    // Leave room after the deepest indentation for the expander, node icons,
    // a readable label, and the row actions. Long labels still ellipsize.
    const minTreeWidth =
      indentPadding(L.max(visibleNodes.map((node) => node.indent)) ?? 0) + 200;

    return (
      // For now, we don't know how much space to request, so we just request 5000.
      // Ideally, we'd want to know exactly how many tree nodes are shown so we can
      // just request the space we need.  Unfortunately, the way FixedSizeTree works
      // right now, there's no way to get that information cheaply without walking
      // through the tree again ourselves.  We should consider skipping FixedSizeTree
      // and just going straight to FixedSizeList instead.
      <ListSpace space={5000}>
        {({ height }) =>
          // When the outline is closed, ListSpace sets the height as 0.
          // If an element is focused while the height is 0, useRevealOnFocus
          // will scroll the FixedSizeList. When the outline is opened,
          // the scroll persists, causing FixedSizeList to only render elements
          // after the scroll offset.
          //
          // This may be a bug on FixedSizeList not adjusting scroll offset
          // automatically when the height changes.
          //
          // To prevent this, don't render the FixedSizeList if height is 0.
          height > 0 && (
            <FixedSizeList
              outerElementType={OutlineScrollbar}
              className="tpltree-scroller"
              innerElementType={OutlineTreeInner}
              style={
                {
                  "--outline-tree-min-width": `${minTreeWidth}px`,
                } as React.CSSProperties
              }
              width={"100%"}
              height={height}
              itemCount={visibleNodes.length}
              itemSize={32}
              overscanCount={2}
              itemData={itemData}
              ref={onRef}
              itemKey={itemKey}
            >
              {ArenaTreeNode}
            </FixedSizeList>
          )
        }
      </ListSpace>
    );
  }),
);

const emptyOutlineRows: readonly OutlineTreeRow[] = Object.freeze([]);
interface OutlineRowsSnapshot { readonly visibleNodes: readonly OutlineTreeRow[]; readonly focusedKey: string | undefined; }
const emptyOutlineSnapshot: OutlineRowsSnapshot = Object.freeze({ visibleNodes: emptyOutlineRows, focusedKey: undefined });
/** Native input ownership ends at the readonly row projection. Tree renderers
 * never use a discarded invalidation to reopen mutable models. */
class OutlineRowsInput {
  private readonly metadata: CanvasViewInputs;
  private current = emptyOutlineSnapshot;
  private previous: readonly unknown[] | undefined;
  private connected = false;
  private capture: object | undefined;
  private readonly stops = new Map<CanvasObserverInput | CanvasViewInputs, () => void>();
  private readonly outlineSources = new Set<CanvasObserverInput>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly studio: StudioCtx, private readonly arena: AnyArena | null, private readonly outline: OutlineCtx, private readonly world: VariantModelWorld) {
    this.metadata = new CanvasViewInputs({ studio, models: world.models, signal: world.lifetime }, (field) => outlineTabFields(world.site, arena, field));
  }
  private sources() {
    const sources = new Set<CanvasObserverInput | CanvasViewInputs>([this.studio.arenaState.store, this.metadata, this.outline.stateStore, this.studio.selectionStore, this.studio.hoveredViewStore, this.studio.arenaState.viewRegistry.store]);
    this.outlineSources.clear(); this.outlineSources.add(this.outline.stateStore);
    const mixed = isMixedArena(this.arena);
    const contexts = mixed ? getArenaFrames(this.arena).map((frame) => ({ context: this.outline.getFrameOutline(frame), expanded: this.outline.isFrameExpanded(frame) })) : [{ context: this.outline, expanded: true }];
    for (const { context, expanded } of contexts) {
      sources.add(context.stateStore); this.outlineSources.add(context.stateStore);
      // Collapsed artboards need expansion/selection state, but none of their
      // node, style or Val inputs until their layers are actually shown.
      if (!expanded) { continue; }
      const view = context.viewCtx();
      if (view) { sources.add(getOutlineModelInput(view)); }
    }
    return sources;
  }
  private disconnect = () => {
    this.connected = false;
    this.world.lifetime.removeEventListener("abort", this.changed);
    this.stops.forEach((stop) => stop()); this.stops.clear();
  };
  read = (): OutlineRowsSnapshot => {
    const capture = {}; this.capture = capture;
    if (!this.world.isCurrent()) { this.current = emptyOutlineSnapshot; this.disconnect(); return this.current; }
    const active = this.studio.currentArena === this.arena;
    if (active && !this.metadata.getSnapshot().alive) { this.current = emptyOutlineSnapshot; this.disconnect(); return this.current; }
    // Keep the arena signal during a temporary A-B-A switch, but never reopen
    // frame resources belonging to an inactive arena's still-mounted UI.
    const sources = active ? this.sources() : new Set<CanvasObserverInput | CanvasViewInputs>([this.studio.arenaState.store]);
    if (!active) {
      this.outlineSources.clear(); this.previous = undefined; this.current = emptyOutlineSnapshot;
    } else {
      const values = [...sources].map((source) => "getSnapshot" in source ? source.getSnapshot() : source.getState());
      if (!this.previous || !arrayEq(this.previous, values)) {
        this.previous = values;
        const focusedNodeKey = this.outline.focusedNodeKeyPath()[0];
        const focusedFrame = this.studio.selectionStore.getState().view?.arenaFrame();
        const focusedKey = isMixedArena(this.arena) && focusedFrame && focusedNodeKey ? focusedNodeKey === makeNodeKey(focusedFrame) ? focusedFrame.uuid : `${focusedFrame.uuid}:${focusedNodeKey}` : focusedNodeKey;
        this.current = Object.freeze({ visibleNodes: Object.freeze(buildVisibleOutlineRows(this.arena, this.outline)), focusedKey });
      }
    }
    if (this.connected) {
      for (const source of sources) {
        if (!this.stops.has(source)) {
          const pending = () => undefined;
          this.stops.set(source, pending);
          const stop = source.subscribe(() => { if (this.world.isCurrent() && this.studio.currentArena === this.arena && (!("getState" in source) || !this.outlineSources.has(source))) { this.outline.refreshVariantSearch(); } this.changed(); });
          if (this.connected && this.stops.get(source) === pending) { this.stops.set(source, stop); } else { stop(); }
        }
        if (this.capture !== capture) { return this.current; }
      }
      for (const [source, stop] of this.stops) { if (!sources.has(source)) { stop(); this.stops.delete(source); } }
    }
    return this.current;
  };
  private changed = () => { const previous = this.current; this.read(); if (previous !== this.current) { this.listeners.forEach((listener) => listener()); } };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.connected && this.world.isCurrent()) { this.connected = true; this.world.lifetime.addEventListener("abort", this.changed, { once: true }); this.read(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
function useTreeData(studioCtx: StudioCtx, arena: AnyArena | null, outlineCtx: OutlineCtx) {
  const world = useVariantModelWorld(studioCtx, arena ?? studioCtx.site);
  const source = React.useMemo(() => new OutlineRowsInput(studioCtx, arena, outlineCtx, world), [studioCtx, arena, outlineCtx, world]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.read, source.read);
  React.useLayoutEffect(() => { outlineCtx.refreshVariantSearch(); }, [outlineCtx, source]);
  return snapshot;
}

export function buildVisibleOutlineRows(
  arena: AnyArena | null,
  outlineCtx: OutlineCtx,
) {
  const rows: OutlineTreeRow[] = [];
  const pushNode = (
    node: OutlineNode,
    context: OutlineCtx,
    frame?: ArenaFrame,
  ) => {
    if (!context.isVisible(node.self.key)) {
      return;
    }
    const indent = node.self.indent + (frame ? 1 : 0);
    const isOpen = context.isExpanded(node.self.key);
    rows.push({
      type: "node",
      key: frame ? `${frame.uuid}:${node.self.key}` : node.self.key,
      indent,
      node: { ...node.self, indent, isOpen },
      outlineCtx: context,
    });
    if (isOpen) {
      node.children.forEach((child) => pushNode(child, context, frame));
    }
  };
  if (isMixedArena(arena)) {
    for (const frame of getArenaFrames(arena)) {
      rows.push({ type: "artboard", key: frame.uuid, indent: 0, frame });
      if (outlineCtx.isFrameExpanded(frame)) {
        const context = outlineCtx.getFrameOutline(frame);
        const root = context.rootTreeNode();
        if (root) {
          pushNode(root, context, frame);
        }
      }
    }
  } else {
    const root = outlineCtx.rootTreeNode();
    if (root) {
      pushNode(root, outlineCtx);
    }
  }
  return rows;
}

/**
 * When a new object is focused, "reveals" it by scrolling to it
 */
function useRevealOnFocus(opts: {
  listRef: React.MutableRefObject<FixedSizeList | null>;
  focusedKey: string | undefined;
  getKeyIndex: (key: string) => number;
}) {
  const { listRef, getKeyIndex, focusedKey } = opts;

  const scrollToKey = React.useCallback(
    (key: string | undefined) => {
      if (!key) {
        return;
      }
      if (listRef.current) {
        const index = getKeyIndex(key);
        if (index >= 0) {
          // Ideally we would scroll to "center", but "center" is buggy :-/
          listRef.current.scrollToItem(index, "smart");
        }
      }
    },
    [listRef, getKeyIndex],
  );

  useChanged(focusedKey, scrollToKey);
}

const TplVisibilityToggle = function TplVisibilityToggle(props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
  visibility: TplVisibility;
  isHidden: boolean;
  visibilityDataCond: Expr | null | undefined;
  ancestorHidden: boolean;
  takeSpace: boolean;
  canvasEnv?: CanvasEnv;
}) {
  const {
    tpl,
    viewCtx,
    visibility,
    isHidden,
    ancestorHidden,
    takeSpace,
    visibilityDataCond,
    canvasEnv,
  } = props;
  const [menuShown, setMenuShown] = React.useState(false);
  const elt = (
    <Tooltip title={<UiText message={isHidden ? "Unhide" : "Hide"} />}>
      <div
        className={cx({
          "tpltree__label__action-icon": true,
          tpltree__label__visibility: true,
          "tpltree__label__action-icon--visible":
            isHidden || ancestorHidden || menuShown,
          "tpltree__label__action-icon--take-space": takeSpace,
        })}
        onClick={() => {
          viewCtx.change(() => {
            const newVisibility = !isHidden
              ? canSetDisplayNone(viewCtx.studioCtx.codeComponentsRegistry, tpl)
                ? TplVisibility.DisplayNone
                : TplVisibility.NotRendered
              : TplVisibility.Visible;
            viewCtx.getViewOps().setTplVisibility(tpl, newVisibility);
            setMenuShown(false);
          });
        }}
      >
        {getVisibilityIcon(visibility)}
      </div>
    </Tooltip>
  );
  return elt;
};
import { isFixedSlotRoot } from "@/wab/client/components/canvas/fixed-slot-root";
