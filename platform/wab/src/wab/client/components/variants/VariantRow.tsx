import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import { useVariantComboInputs } from "@/wab/client/studio-ctx/variant-combo-inputs";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useContextMenu } from "@/wab/client/components/ContextMenu";
import { PlumyIcon } from "@/wab/client/components/plume/plume-markers";
import {
  VariantSettingPopoverContent,
  VariantSettingPopoverTitle,
} from "@/wab/client/components/style-controls/DefinedIndicator";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { UiText } from "@/wab/client/i18n/UiText";
import { useI18n } from "@/wab/client/i18n";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import VariantIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Variant";
import KeyframesIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Keyframes";
import {
  PlasmicVariantRow,
  PlasmicVariantRow__OverridesType,
  PlasmicVariantRow__VariantsArgs,
} from "@/wab/client/plasmic/plasmic_kit_variants/PlasmicVariantRow";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { UiActionsOverlay } from "@/wab/client/studio-ctx/ui/studio-ui-actions";
import { mkModelUiId } from "@/wab/client/studio-ctx/ui/studio-ui-ids";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { VariantPinState } from "@/wab/shared/PinManager";
import {
  VariantCombo,
  isBaseVariant,
  isVariantSettingEmpty,
  tryGetVariantSetting,
} from "@/wab/shared/Variants";
import { maybe } from "@/wab/shared/common";
import { isTplVariantable, summarizeTpl } from "@/wab/shared/core/tpls";
import { getEffectiveVariantSetting } from "@/wab/shared/effective-variant-setting";
import { Variant } from "@/wab/shared/model/classes";
import { PlumeVariantDef } from "@/wab/shared/plume/plume-registry";
import * as React from "react";
import { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

interface VariantRowProps {
  studioCtx: StudioCtx;
  viewCtx?: ViewCtx;
  variant: Variant | VariantCombo;
  pinState: VariantPinState | undefined;
  label?: React.ReactNode;
  menu?: () => React.ReactElement;
  className?: string;
  style?: React.CSSProperties;
  isReadOnly?: boolean;
  isStandalone?: boolean;
  isSplitVariant?: boolean;
  isDragging?: boolean;
  isDraggable?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps;
  onClick?: () => void;
  onTarget?: (target: boolean) => void;
  onToggle?: () => void;
  plumeDef?: PlumeVariantDef;
  hasCodeExpression?: boolean;
  exprButton?: PlasmicVariantRow__OverridesType["exprButton"];
  addAnimationLayer?: () => void;
  type?: PlasmicVariantRow__VariantsArgs["type"];
  additional?: React.ReactNode;
  hideIcon?: boolean;
  previewAnimationContainer?: PlasmicVariantRow__OverridesType["previewAnimationContainer"];
}

export function pinStateToPlasmicPinState(pinState?: VariantPinState) {
  if (!pinState) {
    return undefined;
  }

  return pinState.startsWith("selected")
    ? "selected"
    : pinState === "pinned-true"
      ? "pinnedTrue"
      : pinState === "pinned-false"
        ? "pinnedFalse"
        : pinState === "evaluated-true"
          ? "evaluatedTrue"
          : undefined;
}

const VariantRow = React.memo(function VariantRow(props: VariantRowProps) {
  const identity = Array.isArray(props.variant) ? props.variant[0] ?? props.studioCtx : props.variant;
  const world = useVariantModelWorld(props.studioCtx, identity, props.viewCtx);
  if (!world.alive) { return null; }
  return props.viewCtx ? <VariantRowViewInputs {...props} viewCtx={props.viewCtx} /> : <VariantRowContent {...props} />;
});
function VariantRowViewInputs(props: VariantRowProps & { viewCtx: ViewCtx }) {
  const combo = React.useMemo(() => Array.isArray(props.variant) ? props.variant : [props.variant], [props.variant]);
  const { snapshot } = useVariantComboInputs(props.viewCtx, combo);
  return <VariantRowContent {...props} modelSnapshot={snapshot} />;
}
const VariantRowContent = React.memo(function VariantRowContent(props: VariantRowProps & { modelSnapshot?: unknown }) {
  const { t } = useI18n();
  const {
    studioCtx,
    isStandalone,
    isSplitVariant,
    viewCtx,
    pinState,
    variant,
    label,
    className,
    style,
    menu,
    isReadOnly: _isReadOnly,
    isDragging,
    isDraggable,
    dragHandleProps,
    onClick,
    onTarget,
    onToggle,
    plumeDef,
    addAnimationLayer,
    additional,
    hideIcon,
    type,
    previewAnimationContainer,
    modelSnapshot: _modelSnapshot,
    ...rest
  } = props;
  useViewSelection(viewCtx, (state) => state.tpls);

  const contextMenuProps = useContextMenu({ menu });

  const uiId = Array.isArray(variant) ? undefined : mkModelUiId(variant);

  const isBase = isBaseVariant(variant);
  const isRecording = pinState?.startsWith("selected");

  const tpl = viewCtx?.focusedTpl() ?? undefined;
  useVariantLabelInputs(studioCtx, variant, { focusedTag: tpl && isTplVariantable(tpl) && "tag" in tpl ? tpl : undefined });
  const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, Array.isArray(variant) ? variant[0] : variant]);
  const indicatedVs =
    tpl &&
    isTplVariantable(tpl) &&
    maybe(
      tryGetVariantSetting(tpl, Array.isArray(variant) ? variant : [variant]),
      (vs) => (isVariantSettingEmpty(vs) ? undefined : vs),
    );

  const hasAnimations = !!addAnimationLayer;

  return (
    <PlasmicVariantRow
      type={
        type ||
        (isBase
          ? "baseVariant"
          : isStandalone
            ? "toggle"
            : isSplitVariant
              ? "splitVariant"
              : undefined)
      }
      pinState={pinStateToPlasmicPinState(pinState)}
      variantPinButton={{
        onToggle: onToggle ? () => { if (world.isCurrent(viewCtx)) { onToggle(); } } : undefined,
        ...{
          "data-event": "variantspanel-variant-pin-button",
        },
      }}
      recordButton={
        onTarget
          ? {
              tooltip: t(isRecording ? "Stop recording" : "Add to recording"),
              onClick: (e) => {
                e.stopPropagation();
                if (world.isCurrent(viewCtx)) { onTarget(!isRecording); }
              },
              ...{
                "data-test-class": `variant-record-button-${
                  isRecording ? "stop" : "start"
                }`,
                "data-event": "variantspanel-variant-record-button",
              },
            }
          : { render: () => null }
      }
      showAddAnimation={hasAnimations}
      addAnimation={{
        start: <KeyframesIcon className={"text-xlg dimfg"} />,
        end: <PlusIcon className={"text-xlg dimfg"} />,
        ...(addAnimationLayer ? { onClick: () => { if (world.isCurrent(viewCtx)) { addAnimationLayer(); } } } : {}),
      }}
      previewAnimationContainer={previewAnimationContainer}
      root={{
        props: {
          ...contextMenuProps,
          className,
          style,
          "data-test-class": "variant-row",
        },
        wrapChildren: (children) => (
          <>
            {children}
            {uiId && <UiActionsOverlay uiId={uiId} />}
          </>
        ),
      }}
      listItem={{
        menu,
        additional,
        removeAdditionalRowLeftPadding: true,
        onClickMain: () => {
          if (world.isCurrent(viewCtx) && !isDragging) {
            onClick && onClick();
          }
        },
        hideIcon,
        isDraggable,
        isDragging,
        dragHandleProps,
        ...{
          "data-event": "variantspanel-variant-row",
          "data-event-is-base": `${isBase}`,
        },
      }}
      icon={
        plumeDef ? (
          <PlumyIcon def={plumeDef}>
            <Icon icon={VariantIcon} />
          </PlumyIcon>
        ) : (
          <Icon icon={VariantIcon} />
        )
      }
      isIndicated={!!indicatedVs}
      indicator={
        indicatedVs && tpl && viewCtx
          ? {
              popover: () => (
                <VariantSettingPopoverContent
                  site={studioCtx.site}
                  tpl={tpl}
                  vs={indicatedVs}
                  viewCtx={viewCtx}
                />
              ),

              popoverTitle: () => (
                <VariantSettingPopoverTitle vs={indicatedVs} viewCtx={viewCtx}>
                  {
                    <UiText
                      message={'Settings for element "{part1}"'}
                      values={{
                        part1: String(
                          summarizeTpl(
                            tpl,
                            isTplVariantable(tpl)
                              ? getEffectiveVariantSetting(
                                  tpl,
                                  indicatedVs?.variants,
                                ).rsh()
                              : undefined,
                          ),
                        ),
                      }}
                    />
                  }
                </VariantSettingPopoverTitle>
              ),

              placement: "left",
            }
          : undefined
      }
      {...rest}
    >
      {label}
    </PlasmicVariantRow>
  );
});

export default VariantRow;
