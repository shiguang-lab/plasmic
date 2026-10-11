import { useSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { getNodeSummary } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import {
  MultiSelectionProp,
  getMultiSelectionFieldState,
  getMultiSelectionProviders,
  multiSelectionFields,
  setMultiSelectionStyle,
} from "@/wab/client/components/sidebar-tabs/multi-selection";
import { PopoverFrameProvider } from "@/wab/client/components/sidebar/PopoverFrame";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { ColorButton } from "@/wab/client/components/style-controls/ColorButton";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { useI18n } from "@/wab/client/i18n";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isTokenRef, tokenTypeDimOpts } from "@/wab/commons/StyleToken";
import { spawn } from "@/wab/shared/common";
import { getTplTextBlockContent } from "@/wab/shared/core/tpls";
import { PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { isKnownTplSlot } from "@/wab/shared/model/classes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Typography } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import React from "react";

export const useMultiSelectionStyles = createStyles(({ token }) => ({
  root: { flex: 1, minHeight: 0, color: token.colorText },
  section: {
    padding: 16,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  heading: { fontSize: 12, fontWeight: 600, margin: "0 0 12px" },
  bounds: { display: "flex", gap: 24, fontVariantNumeric: "tabular-nums" },
  row: {
    display: "grid",
    gridTemplateColumns: "88px minmax(0, 1fr) 24px",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  control: { minWidth: 0, "& > *": { width: "100%" } },
  layers: {
    margin: "12px 0 0",
    padding: 0,
    listStyle: "none",
    "& li": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      padding: "4px 0",
      color: token.colorTextSecondary,
    },
  },
}));

export const MultiSelectionPanel = observer(function MultiSelectionPanel({
  viewCtx,
}: {
  viewCtx: ViewCtx;
}) {
  const { t } = useI18n();
  const panelId = React.useId();
  const { styles } = useMultiSelectionStyles();
  const bounds = useSelectionBounds(viewCtx);
  const providers = getMultiSelectionProviders(viewCtx);
  const fieldStates = (
    Object.keys(multiSelectionFields) as MultiSelectionProp[]
  ).map((prop) => ({
    prop,
    ...getMultiSelectionFieldState(viewCtx, providers, prop),
  }));
  const renderFields = (props: MultiSelectionProp[]) =>
    fieldStates
      .filter((field) => props.includes(field.prop) && field.supported)
      .map(({ prop, value, mixed, disabled }) => {
        const caption = t(multiSelectionFields[prop].label);
        const inputId = `${panelId}-${prop}`;
        const labelId = `${inputId}-label`;
        const onChange = (next: string | undefined) =>
          spawn(setMultiSelectionStyle(viewCtx, prop, next));
        const opacity = prop === "opacity";
        return (
          <div
            className={styles.row}
            key={prop}
            data-multi-selection-prop={prop}
            role="group"
            aria-labelledby={labelId}
          >
            <label
              id={labelId}
              htmlFor={prop === "color" ? undefined : inputId}
            >
              {caption}
            </label>
            <div className={styles.control}>
              {prop === "color" ? (
                <>
                  {mixed && (
                    <Typography.Text type="secondary">
                      {t("Mixed")}
                    </Typography.Text>
                  )}
                  <ColorButton
                    sc={viewCtx.studioCtx}
                    color={value}
                    onChange={onChange}
                    isDisabled={disabled}
                    popupTitle={caption}
                    data-plasmic-prop={prop}
                  />
                </>
              ) : (
                <DimTokenSpinner
                  studioCtx={viewCtx.studioCtx}
                  fieldAriaProps={{ id: inputId, "aria-labelledby": labelId }}
                  data-plasmic-prop={prop}
                  tokenType={
                    opacity
                      ? "Opacity"
                      : prop === "font-size"
                        ? "FontSize"
                        : "Spacing"
                  }
                  {...(opacity
                    ? {
                        allowedUnits: PERCENTAGE_UNITS,
                        allowFunctions: false,
                        max: 100,
                      }
                    : tokenTypeDimOpts("Spacing"))}
                  min={0}
                  extraOptions={
                    prop === "width" || prop === "height" ? ["auto"] : []
                  }
                  value={
                    opacity && value && !isTokenRef(value)
                      ? `${Number(value) * 100}%`
                      : (value ?? "")
                  }
                  placeholder={mixed ? t("Mixed") : undefined}
                  disabled={disabled}
                  onChange={(next) =>
                    onChange(
                      opacity && next && !isTokenRef(next)
                        ? String(parseFloat(next) / 100)
                        : next,
                    )
                  }
                />
              )}
            </div>
            <Button
              type="text"
              size="small"
              disabled={disabled}
              aria-label={`${t("Reset")} ${caption}`}
              title={t("Reset")}
              onClick={() => onChange(undefined)}
            >
              ↺
            </Button>
          </div>
        );
      });
  return (
    <PopoverFrameProvider containerSelector=".multi-selection-panel">
      <SidebarModalProvider containerSelector=".multi-selection-panel">
        <Scrollbar
          scrollX={false}
          className={`${styles.root} multi-selection-panel studio-scrollbar`}
        >
          <section className={styles.section}>
            <h3 className={styles.heading}>{t("Selection bounds")}</h3>
            {bounds && (
              <div className={styles.bounds}>
                <span>W {Math.round(bounds.width())}</span>
                <span>H {Math.round(bounds.height())}</span>
              </div>
            )}
            <ul className={styles.layers}>
              {providers.map((provider) => {
                const tpl = provider.tpl;
                const name =
                  (!isKnownTplSlot(tpl) && tpl.name) ||
                  getTplTextBlockContent(tpl, viewCtx) ||
                  getNodeSummary(tpl, provider.effectiveVs().rsh());
                return (
                  <li key={tpl.uuid} title={name}>
                    {name}
                  </li>
                );
              })}
            </ul>
          </section>
          {fieldStates.some((field) => field.supported) ? (
            <>
              {fieldStates.some(
                (field) =>
                  field.supported && ["width", "height"].includes(field.prop),
              ) && (
                <section className={styles.section}>
                  <h3 className={styles.heading}>{t("Size")}</h3>
                  {renderFields(["width", "height"])}
                </section>
              )}
              {fieldStates.some(
                (field) =>
                  field.supported &&
                  ["opacity", "border-radius"].includes(field.prop),
              ) && (
                <section className={styles.section}>
                  <h3 className={styles.heading}>{t("Appearance")}</h3>
                  {renderFields(["opacity", "border-radius"])}
                </section>
              )}
              {fieldStates.some(
                (field) =>
                  field.supported &&
                  ["font-size", "color"].includes(field.prop),
              ) && (
                <section className={styles.section}>
                  <h3 className={styles.heading}>{t("Typography")}</h3>
                  {renderFields(["font-size", "color"])}
                </section>
              )}
              <section className={styles.section}>
                <Typography.Text type="secondary">
                  {t("Changes apply to all selected layers.")}
                </Typography.Text>
              </section>
            </>
          ) : (
            <section className={styles.section}>
              <Typography.Text type="secondary">
                {t("These layers have no shared editable styles.")}
              </Typography.Text>
            </section>
          )}
        </Scrollbar>
      </SidebarModalProvider>
    </PopoverFrameProvider>
  );
});
