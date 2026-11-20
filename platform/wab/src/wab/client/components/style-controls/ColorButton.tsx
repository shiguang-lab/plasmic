import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import { PropValuePath } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import {
  PopoverFrame,
  useMaybePopoverFrameContext,
} from "@/wab/client/components/sidebar/PopoverFrame";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { ValueSetState } from "@/wab/client/components/sidebar/sidebar-helpers";
import { ColorPicker } from "@/wab/client/components/widgets/ColorPicker";
import { useClientTokenValue } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { useI18n } from "@/wab/client/i18n";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import styles from "@/wab/client/components/style-controls/ColorButton.module.scss";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import cn from "classnames";

import PlasmicColorButton from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicColorButton";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isTokenRef } from "@/wab/commons/StyleToken";

import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { zeroWidthSpace } from "@/wab/shared/common";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { FinalToken } from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import Chroma from "@/wab/shared/utils/color-utils";
import { InputNumber, Popover, Tooltip } from "antd";
import * as React from "react";
import { useCallback, useState } from "react";

type ColorButtonProps = {
  color?: string;
  onChange: (colorOrToken: string) => any;
  hideTokenPicker?: boolean;
  sc: StudioCtx;
  derefToken?: boolean;
  className?: string;
  leadingIcon?: React.ReactNode;
  "aria-label"?: string;
  emptyLabel?: string;
  floatingPicker?: boolean;
  showValue?: boolean;
  popupTitle?: React.ReactNode;
  valueSetState?: ValueSetState;
  isDisabled?: boolean;
  disabledTooltip?: React.ReactNode | (() => React.ReactNode);
  vsh?: VariantedStylesHelper;
  "data-plasmic-prop"?: string;
  /**
   * Value path for PopoverFrame, used when color picker is opened in component props.
   * If provided, the color picker will open as a PopoverFrame instead of SidebarModal.
   */
  valuePath?: PropValuePath;
};

function ColorButtonContent(props: ColorButtonProps) {
  const { t: studioUiT } = useI18n();

  const {
    color,
    onChange,
    derefToken,
    sc,
    hideTokenPicker,
    popupTitle,
    valueSetState,
    isDisabled: disabled,
    className,
    leadingIcon,
    floatingPicker,
    disabledTooltip,
    vsh,
    valuePath,
  } = props;
  const inspecting = React.useContext(InspectorReadOnly);
  const isDisabled = disabled && !inspecting;
  const [buttonElement, setButtonElement] = useState<HTMLElement | null>(null);
  const [show, setShow] = useState(false);
  const popoverFrameContext = useMaybePopoverFrameContext();
  const floatingRef = React.useRef<HTMLDivElement>(null);

  // Only use PopoverFrame when there's an active on with non-empty stack
  const usePopoverFrame = valuePath && popoverFrameContext?.state.stack.length;

  const tokenRef = !!color && isTokenRef(color);
  const defaultVsh = React.useMemo(() => new VariantedStylesHelper(sc.site), [sc, sc.site]);
  const { selected, lifetime } = useStyleTokenRefs(sc, [color ?? ""], vsh ?? defaultVsh, "Color", (snapshot) => snapshot.rows[0]);
  const resolved = selected?.resolved;
  const clientValue = useClientTokenValue(resolved?.value, resolved, lifetime);
  const appliedToken = selected?.applied;
  const realColor = appliedToken ? (clientValue ?? "") : (color ?? "");
  const tooltip = isDisabled ? disabledTooltip : undefined;
  React.useEffect(() => {
    const closeScope = () => setShow(false);
    if (lifetime.aborted) { closeScope(); return; }
    lifetime.addEventListener("abort", closeScope, { once: true });
    return () => lifetime.removeEventListener("abort", closeScope);
  }, [lifetime]);

  const handleClose = useCallback(() => {
    setShow(false);
    // focus on next frame since we are currently in modal's FocusScope
    setTimeout(() => buttonElement?.focus());
  }, [buttonElement]);
  useStudioEscape(floatingRef, Boolean(floatingPicker && show), handleClose);

  if (floatingPicker) {
    const label = props["aria-label"];
    const validColor = Chroma.valid(realColor);
    const valueLabel = appliedToken?.name ?? (tokenRef
      ? studioUiT("Invalid token")
      : validColor ? Chroma(realColor).hex("rgb").slice(1).toUpperCase()
      : color || props.emptyLabel || studioUiT("Mixed"));
    const trigger = (
      <div className={cn(styles.triggerGroup, { [paintStyles.fillValue]: props.showValue })}>
        <Popover
          trigger="click"
          open={show && !isDisabled}
          onOpenChange={(open) => !isDisabled && setShow(open)}
          placement="leftTop"
          arrow={false}
          destroyOnHidden
          content={
            <div ref={floatingRef} className={styles.floatingPicker} role="dialog" aria-label={label}>
              {popupTitle && <div className={styles.floatingTitle}>{popupTitle}</div>}
              <ColorPicker compact autoFocus color={color || ""} onChange={onChange}
                derefToken={derefToken} hideTokenPicker={hideTokenPicker} vsh={vsh} />
            </div>
          }
        >
          <button
            ref={setButtonElement}
            type="button"
            className={cn(styles.trigger, className, { [styles.withValue]: props.showValue })}
            disabled={isDisabled}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={show && !isDisabled}
            data-plasmic-prop={props["data-plasmic-prop"]}
          >
            {leadingIcon}
            <span className={paintStyles.fillSwatch} aria-hidden="true">
              <span data-color-swatch style={{ backgroundColor: realColor || "transparent" }} />
            </span>
            {props.showValue && <span className={paintStyles.fillLabel}>{valueLabel}</span>}
          </button>
        </Popover>
        {props.showValue && (
          <Tooltip title={tokenRef ? studioUiT("Opacity is controlled by the color token") : studioUiT("Opacity")}>
            {inspecting ? <span>{validColor ? Math.round(Chroma(realColor).alpha() * 100) + "%" : "—"}</span> : <InputNumber
              aria-label={studioUiT("Opacity")}
              className={paintStyles.fillOpacity}
              value={validColor ? Math.round(Chroma(realColor).alpha() * 100) : null}
              disabled={isDisabled || tokenRef || !validColor}
              placeholder="–" min={0} max={100} controls={false} suffix="%"
              onChange={(value) => {
                if (value !== null && validColor && !tokenRef) {
                  onChange(Chroma(realColor).alpha(value / 100).hex());
                }
              }}
            />}
          </Tooltip>
        )}
      </div>
    );
    return tooltip ? (
      <Tooltip title={tooltip}>
        <span>{trigger}</span>
      </Tooltip>
    ) : (
      trigger
    );
  }

  return (
    <>
      <PlasmicColorButton
        swatch={{
          color: realColor,
          className: "baseline-friendly-centered-block-container",
        }}
        label={
          appliedToken
            ? appliedToken.name
            : tokenRef
              ? studioUiT("Invalid token")
              : color != null
                ? Chroma.stringify(color)
                : props.emptyLabel ?? zeroWidthSpace
        }
        valueSetState={valueSetState}
        overrides={{
          root: {
            props: {
              ref: setButtonElement,
              type: "button",
              "data-plasmic-prop": props["data-plasmic-prop"],
              onClick: (e) => {
                if (isDisabled) {
                  // We handle isDisabled explicitly this way, instead of setting disabled
                  // attr, because otherwise we cannot capture the mouse events necessary
                  // to show the disabledTooltip
                  e.stopPropagation();
                  e.preventDefault();
                } else {
                  setShow(true);
                }
              },
              className,
              "aria-label": props["aria-label"],
              "aria-disabled": isDisabled,
            },
            wrap: (elt) => {
              return tooltip ? (
                <Tooltip title={tooltip}>
                  <TriggerTarget>{elt}</TriggerTarget>
                </Tooltip>
              ) : (
                elt
              );
            },
          },
        }}
        isDisabled={isDisabled}
      />
      {usePopoverFrame ? (
        <PopoverFrame
          show={show}
          title={popupTitle}
          valuePath={valuePath!}
          onClose={handleClose}
          triggerElement={buttonElement ?? undefined}
        >
          <div className="panel-content">
            <ColorPicker
              autoFocus={true}
              color={color || ""}
              onChange={onChange}
              derefToken={derefToken}
              hideTokenPicker={hideTokenPicker}
              vsh={vsh}
            />
          </div>
        </PopoverFrame>
      ) : (
        <ColorSidebarPopup
          color={color}
          onChange={onChange}
          show={show}
          onClose={handleClose}
          popupTitle={popupTitle}
          derefToken={derefToken}
          hideTokenPicker={hideTokenPicker}
          autoFocus={true}
          vsh={vsh}
        />
      )}
    </>
  );
}

export const ColorButton = ColorButtonContent;

export const ColorSidebarPopup = function ColorSidebarPopup(props: {
  color?: string;
  onChange: (colorOrToken: string) => any;
  show: boolean;
  onClose: () => void;
  popupTitle?: React.ReactNode;
  derefToken?: boolean;
  hideTokenPicker?: boolean;
  autoFocus?: boolean;
  colorTokens?: FinalToken<StyleToken>[];
  vsh?: VariantedStylesHelper;
}) {
  const {
    color,
    onChange,
    show,
    derefToken,
    hideTokenPicker,
    colorTokens,
    vsh,
  } = props;

  return (
    <SidebarModal
      show={show}
      onClose={props.onClose}
      title={
        props.popupTitle && (
          <div className="flex flex-vcenter flex-fill">{props.popupTitle}</div>
        )
      }
      dismissOnEnter={true}
    >
      <div className="panel-content">
        <ColorPicker
          autoFocus={props.autoFocus}
          color={color || ""}
          onChange={onChange}
          derefToken={derefToken}
          hideTokenPicker={hideTokenPicker}
          colorTokens={colorTokens}
          vsh={vsh}
        />
      </div>
    </SidebarModal>
  );
};
