import { InspectorReadOnly, InspectorEdit } from "@/wab/client/components/studio/inspector-access";
import { LabeledStyleColorItem, LabeledStyleDimItem, shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import styles from "@/wab/client/components/style-controls/OutlineControls.module.scss";
import { StylePanelSection, useStyleTarget } from "@/wab/client/components/style-controls/StyleComponent";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import { useClientTokenValue } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { useI18n } from "@/wab/client/i18n";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import WandIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Wand";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStyleTokenRefs } from "@/wab/client/studio-ctx/style-token-ref-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { LENGTH_UNITS } from "@/wab/shared/css/types";
import { Popover, Tooltip } from "antd";
import React from "react";
import cn from "classnames";
import { FiSlash } from "react-icons/fi";

enum OutlineProps {
  style = "outline-style",
  width = "outline-width",
  offset = "outline-offset",
  color = "outline-color",
}

export const outlineStyleProps = Object.values(OutlineProps);

const defaultOutlineValues = {
  [OutlineProps.style]: "solid",
  [OutlineProps.width]: "1px",
  [OutlineProps.offset]: "0px",
  [OutlineProps.color]: "currentColor",
};

export function OutlinePanelSection() {
  const { t } = useI18n();
  const sc = useStyleTarget();
  const provider = sc.props.expsProvider;
  const cells = useStyleCells(provider, outlineStyleProps);
  const hasOutline = cells.some((cell) => cell.has);
  const indicators = useStyleIndicators(provider, outlineStyleProps);
  const { isDisabled } = shouldBeDisabled({ props: {}, indicators, label: t("CSS outline") });

  return <StylePanelSection title={t("CSS outline")} expsProvider={provider}
    styleProps={outlineStyleProps} headerMenuOnRightClickOnly
    controls={<InspectorEdit><IconButton size="small" aria-label={t("Add outline")} tooltip={t("Add outline")}
      disabled={isDisabled || hasOutline} onClick={() => {
        if (!isDisabled && !hasOutline) {
          sc.change(() => Object.entries(defaultOutlineValues).forEach(([prop, value]) => sc.exp().set(prop, value)));
        }
      }}><Icon icon={PlusIcon} /></IconButton></InspectorEdit>}
  >
    {hasOutline && <ListBox><ListBoxItem index={0} className={paintStyles.fillItem}
      isDragDisabled showGrip={false} disabled={isDisabled} clickable={false} truncate={false}
      removeLabel={t("Remove outline")} onRemove={() => {
        if (!isDisabled) {
          sc.change(() => outlineStyleProps.forEach((prop) => provider.maybeTargetExp()?.clear(prop)));
        }
      }} mainContent={<OutlineRow />} /></ListBox>}
  </StylePanelSection>;
}

function OutlineRow() {
  const { t } = useI18n();
  const sc = useStyleTarget();
  const provider = sc.props.expsProvider;
  const vsh = useVariantedStylesHelperFromCurrentCtx(provider.studioCtx);
  const cells = useStyleCells(provider, outlineStyleProps);
  const indicators = useStyleIndicators(provider, outlineStyleProps);
  const { isDisabled } = shouldBeDisabled({ props: {}, indicators, label: t("CSS outline") });
  const styleCell = cells.find((cell) => cell.key === OutlineProps.style);
  const lineStyle = styleCell?.value;
  const isNone = styleCell?.raw === "none";
  const color = cells.find((cell) => cell.key === OutlineProps.color)?.value;
  const { selected, lifetime } = useStyleTokenRefs(provider.studioCtx, color ? [color] : [], vsh, "Color", (snapshot) => snapshot.rows[0]);
  const resolved = selected?.resolved;
  const clientColor = useClientTokenValue(resolved?.value, resolved, lifetime);
  const previewColor = selected?.applied ? clientColor : color;
  const inspecting = React.useContext(InspectorReadOnly);
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement>(null), popup = React.useRef<HTMLDivElement>(null);
  useStudioEscape(popup, open, () => { setOpen(false); trigger.current?.focus(); });
  const lineStyles = {
    none: t("None"), solid: t("Solid line"), dashed: t("Dashed"), dotted: t("Dotted"), double: t("Double"),
    auto: t("Auto"), groove: t("Outline groove"), ridge: t("Outline ridge"),
    inset: t("Outline inset"), outset: t("Outline outset"),
  };

  return <div className={styles.row} data-test-id="outline-row">
    <Popover trigger="click" open={open && (inspecting || !isDisabled)} onOpenChange={setOpen} placement="leftTop" arrow={false} destroyOnHidden
      content={<div className={styles.popover} ref={popup} role="group" aria-label={t("Outline settings")}>
        <div className={styles.heading}>{t("Line style")}</div>
        <div className={styles.lineStyles} role="group" aria-label={t("Line style")}>
          {Object.entries(lineStyles).map(([style, label]) => <StyleToggleButton key={style}
            className={styles.lineButton} value={style} tooltip={label} isDisabled={isDisabled}
            valueSetState={lineStyle === style ? "isSet" : "isUnset"}
            onClick={() => sc.change(() => {
              if (style === "none") {
                outlineStyleProps.forEach((prop) => provider.maybeTargetExp()?.clear(prop));
              } else if (isNone) {
                Object.entries(defaultOutlineValues).forEach(([prop, value]) => sc.exp().set(prop, value));
              }
              sc.exp().set(OutlineProps.style, style);
            })}>
            {style === "none" ? <FiSlash aria-hidden="true" /> : style === "auto" ? <Icon icon={WandIcon} /> :
              ["groove", "ridge", "inset", "outset"].includes(style) ?
                <span className={styles.relief} style={{ borderStyle: style }} aria-hidden="true" /> :
                <span className={styles.line} style={{ borderTopStyle: style as React.CSSProperties["borderTopStyle"], borderTopWidth: style === "double" ? 3 : 2 }} aria-hidden="true" />}
          </StyleToggleButton>)}
        </div>
      </div>}>
      <Tooltip title={open ? null : t("Outline settings")}><TriggerTarget>
        <button type="button" className={cn(styles.settings, isNone && styles.none)} ref={trigger} disabled={!inspecting && isDisabled}
          aria-label={t("Outline settings")} aria-expanded={open}>
          {isNone ? <><FiSlash aria-hidden="true" /><span>{t("None")}</span></> : <span className={styles.preview} aria-hidden="true" style={{
            color: previewColor,
            borderStyle: lineStyle === "auto" ? "solid" : lineStyle,
            borderWidth: lineStyle === "double" ? 3 : 2,
          }} />}
        </button>
      </TriggerTarget></Tooltip>
    </Popover>
    {!isNone && <>
    <LabeledStyleColorItem styleName={OutlineProps.color} displayStyleName={t("Outline color")}
      noMenuButton hideIndicator vsh={vsh} className={styles.color}
      colorOpts={{ "aria-label": t("Outline color"), popupTitle: t("Outline color"), floatingPicker: true }} />
    <LabeledStyleDimItem aria-label={t("Width")} displayStyleName={t("Width")}
      className={styles.metric} styleName={OutlineProps.width} tokenType="Spacing" vsh={vsh} noMenuButton hideIndicator
      dimOpts={{ tooltip: t("Width"), placeholder: "—", min: 0, allowedUnits: LENGTH_UNITS, allowFunctions: true, hideArrow: false,
        extraOptions: [{ value: "thin", label: t("Thin") }, { value: "medium", label: t("Medium") }, { value: "thick", label: t("Thick") }],
      }} />
    <LabeledStyleDimItem aria-label={t("Offset")} displayStyleName={t("Offset")}
      className={styles.metric} styleName={OutlineProps.offset} tokenType="Spacing" vsh={vsh} noMenuButton hideIndicator
      dimOpts={{ tooltip: t("Offset"), placeholder: "—", allowedUnits: LENGTH_UNITS, allowFunctions: true, hideArrow: false }} />
    </>}
  </div>;
}
