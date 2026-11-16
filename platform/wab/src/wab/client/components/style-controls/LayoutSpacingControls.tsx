import { LabeledStyleDimItem } from "@/wab/client/components/sidebar/sidebar-helpers";
import layoutStyles from "@/wab/client/components/style-controls/LayoutCard.module.scss";
import styles from "@/wab/client/components/style-controls/LayoutSpacingControls.module.scss";
import {
  changeStyle,
  StyleComponentProps,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useI18n } from "@/wab/client/i18n";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { LENGTH_PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { Side, standardSides } from "@/wab/shared/geom";
import * as React from "react";

type SpacingAxis = Side | "horizontal" | "vertical";
const axisSides: Record<SpacingAxis, Side[]> = {
  horizontal: ["left", "right"],
  vertical: ["top", "bottom"],
  left: ["left"],
  right: ["right"],
  top: ["top"],
  bottom: ["bottom"],
};

function SpacingIcon({
  axis,
  kind,
}: {
  axis: SpacingAxis;
  kind: "padding" | "margin";
}) {
  const horizontal =
    axis === "horizontal" || axis === "left" || axis === "right";
  const inner = kind === "padding";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <g transform={horizontal ? "rotate(-90 8 8)" : undefined}>
        {inner ? (
          <rect x="2" y="2" width="12" height="12" rx="1" />
        ) : (
          <rect x="4" y="5" width="8" height="6" rx="1" />
        )}
        {(axis === "vertical" ||
          axis === "horizontal" ||
          axis === "top" ||
          axis === "left") && <path d={inner ? "M5 5h6" : "M2 2h12"} />}
        {(axis === "vertical" ||
          axis === "horizontal" ||
          axis === "bottom" ||
          axis === "right") && <path d={inner ? "M5 11h6" : "M2 14h12"} />}
      </g>
    </svg>
  );
}

function SpacingFields({
  expsProvider,
  vsh,
  readOnly,
  kind,
}: StyleComponentProps & {
  kind: "padding" | "margin";
}) {
  const { t } = useI18n();
  const keys = standardSides.map((side) => `${kind}-${side}`);
  const cells = useStyleCells(expsProvider, keys);
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(
    vsh ? undefined : expsProvider.studioCtx,
  );
  const valueFor = (side: Side) => {
    const value =
      cells.find((cell) => cell.key === `${kind}-${side}`)?.value ?? "0px";
    return value === "0" ? "0px" : value;
  };
  const asymmetric =
    valueFor("left") !== valueFor("right") ||
    valueFor("top") !== valueFor("bottom");
  const [independent, setIndependent] = React.useState<boolean>();
  const showSides = independent ?? asymmetric;
  const label = t(kind === "padding" ? "Padding" : "Margin");
  const fieldLabels =
    kind === "padding"
      ? {
          vertical: t("Vertical padding"),
          horizontal: t("Horizontal padding"),
          left: t("Padding left"),
          right: t("Padding right"),
          top: t("Padding top"),
          bottom: t("Padding bottom"),
        }
      : {
          vertical: t("Vertical margin"),
          horizontal: t("Horizontal margin"),
          left: t("Margin left"),
          right: t("Margin right"),
          top: t("Margin top"),
          bottom: t("Margin bottom"),
        };
  const axes: SpacingAxis[] = showSides
    ? ["left", "right", "top", "bottom"]
    : ["vertical", "horizontal"];

  return (
    <div className={styles.group} role="group" aria-label={label}>
      <div className={styles.label}>{label}</div>
      <div className={styles.controls}>
        <div className={styles.fields}>
          {axes.map((axis) => {
            const sides = axisSides[axis];
            const values = sides.map(valueFor);
            const mixed = new Set(values).size > 1;
            const names = sides.map((side) => `${kind}-${side}`);
            return (
              <LabeledStyleDimItem
                key={axis}
                className={styles.field}
                labelSize="auto"
                alignment="center"
                noMenuButton
                label={<SpacingIcon axis={axis} kind={kind} />}
                aria-label={fieldLabels[axis]}
                tooltip={fieldLabels[axis]}
                displayStyleName={fieldLabels[axis]}
                styleName={names}
                isDisabled={readOnly}
                disabledDragging={readOnly || mixed}
                tokenType="Spacing"
                vsh={vsh ?? currentVsh}
                dimOpts={{
                  className: styles.input,
                  value: mixed ? "" : values[0],
                  placeholder: mixed ? t("Mixed") : undefined,
                  onChange: (value) => {
                    if (readOnly) {
                      return;
                    }
                    changeStyle(expsProvider, () => {
                      const exp = expsProvider.mergedExp();
                      names.forEach((name) =>
                        value === undefined
                          ? exp.clear(name)
                          : exp.set(name, value),
                      );
                    });
                  },
                  extraOptions: kind === "margin" ? ["auto"] : [],
                  min: kind === "padding" ? 0 : undefined,
                  dragScale: "10",
                  allowedUnits: LENGTH_PERCENTAGE_UNITS,
                  allowFunctions: true,
                }}
              />
            );
          })}
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-label={`${label}: ${t("Independent edges")}`}
          title={t(
            showSides
              ? "Independent edges (click to link)"
              : "Opposite edges linked (click to unlink)",
          )}
          aria-pressed={showSides}
          onClick={() => setIndependent(!showSides)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            aria-hidden="true"
          >
            <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function LayoutSpacingControls({
  expsProvider,
  vsh,
  paddingVisible,
  marginVisible,
  readOnly,
}: StyleComponentProps & { paddingVisible: boolean; marginVisible: boolean }) {
  return (
    <div className={layoutStyles.spacingControls}>
      {paddingVisible && (
        <SpacingFields
          kind="padding"
          expsProvider={expsProvider}
          vsh={vsh}
          readOnly={readOnly}
        />
      )}
      {marginVisible && (
        <SpacingFields
          kind="margin"
          expsProvider={expsProvider}
          vsh={vsh}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
