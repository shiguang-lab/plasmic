import {
  FullRow,
  LabeledFontFamilySelector,
  LabeledItem,
  LabeledStyleColorItem,
  LabeledStyleDimItem,
  LabeledStyleItem,
  LabeledStyleSelectItem,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { useStyleTarget } from "@/wab/client/components/style-controls/StyleComponent";
import styles from "@/wab/client/components/style-controls/Typography.module.scss";
import { Icon, type IconProps } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import type { MessageKey } from "@/wab/client/i18n/locales";
import CapitalizeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Capitalize";
import ClipIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Clip";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import GridViewIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__GridView";
import ItalicsFalseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ItalicsFalse";
import ItalicsTrueIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ItalicsTrue";
import JustifyIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Justify";
import LowerIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Lower";
import StrikeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Strike";
import UnderIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Under";
import UpperIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Upper";
import WrapIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Wrap";
import DotsHorizontalIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__DotsHorizontal";
import AlignBottomIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignBottomSvg";
import AlignHorizontalCenterIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignHorizontalCenterSvg";
import AlignLeftIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignLeftSvg";
import AlignRightIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignRightSvg";
import AlignTopIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignTopSvg";
import AlignVerticalCenterIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__AlignVerticalCenterSvg";
import LetterSpacingIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__LetterSpacingSvg";
import LineHeightIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__LineHeightSvg";
import {
  useStyleCells,
  useStyleIndicators,
} from "@/wab/client/studio-ctx/style-inputs-react";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import {
  fontWeightOptions,
  isValidFontWeight,
} from "@/wab/client/typography-utils";
import { derefTokenRefs, tokenTypeDimOpts } from "@/wab/commons/StyleToken";
import { filterMapTruthy } from "@/wab/shared/common";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { fontWeightNumber, parseCssNumericNew } from "@/wab/shared/css";
import type { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { FontColorsOutlined } from "@ant-design/icons";
import { notification, Popover, Tooltip } from "antd";
import * as React from "react";
import { useStore } from "zustand";

type TypeOption = readonly [
  value: string,
  label: MessageKey,
  icon: IconProps["icon"],
];

const horizontalAlignment = [
  ["left", "Align left", AlignLeftIcon],
  ["center", "Align center", AlignHorizontalCenterIcon],
  ["right", "Align right", AlignRightIcon],
  ["justify", "Justify", JustifyIcon],
] as const satisfies readonly TypeOption[];

const verticalAlignment = [
  ["start", "Top", AlignTopIcon],
  ["center", "Middle", AlignVerticalCenterIcon],
  ["end", "Bottom", AlignBottomIcon],
] as const satisfies readonly TypeOption[];

function TypographyOptions({
  name,
  label,
  options,
  value,
  readOnly,
  disabledTooltip,
  onChange,
}: {
  name?: string;
  label: MessageKey;
  options: readonly TypeOption[];
  value: string;
  readOnly?: boolean;
  disabledTooltip?: React.ReactNode | (() => React.ReactNode);
  onChange?: (value: string) => void;
}) {
  const { t } = useI18n();
  const sc = useStyleTarget();
  const provider = sc.props.expsProvider;
  const indicators = useStyleIndicators(provider, name ? [name] : []);
  const disabled = shouldBeDisabled({
    props: { isDisabled: !name || readOnly, disabledTooltip },
    label: t(label),
    indicators,
  });
  const controls = (
    <Tooltip title={disabled.isDisabled ? disabled.disabledTooltip : undefined}>
      <div role="group" aria-label={t(label)} className={styles.options}>
        {options.map(([option, message, icon]) => (
          <Tooltip
            key={option}
            title={disabled.isDisabled ? undefined : t(message)}
          >
            <button
              type="button"
              aria-label={t(message)}
              aria-pressed={!!name && value === option}
              disabled={disabled.isDisabled}
              onClick={() => {
                if (onChange) {
                  onChange(option);
                } else if (name) {
                  sc.change(() => provider.targetExp().set(name, option));
                }
              }}
            >
              <Icon icon={icon} aria-hidden="true" />
            </button>
          </Tooltip>
        ))}
      </div>
    </Tooltip>
  );
  return name ? (
    <LabeledStyleItem
      styleName={name}
      displayStyleName={t(label)}
      definedIndicator={indicators}
      noMenuButton
      isDisabled={disabled.isDisabled}
    >
      {controls}
    </LabeledStyleItem>
  ) : (
    <LabeledItem isDisabled noMenuButton>
      {controls}
    </LabeledItem>
  );
}

export function Typography({
  vsh,
  readOnly,
  animatableOnly,
  verticalAlign,
  warnOnRelativeUnits,
}: {
  vsh?: VariantedStylesHelper;
  readOnly?: boolean;
  animatableOnly?: boolean;
  verticalAlign?: boolean;
  warnOnRelativeUnits?: boolean;
}) {
  const { t } = useI18n();
  const sc = useStyleTarget();
  const provider = sc.props.expsProvider;
  const studio = sc.studioCtx();
  const fallbackVsh = useVariantedStylesHelperFromCurrentCtx(
    vsh ? undefined : studio,
  );
  const styleHelper = vsh ?? fallbackVsh;
  const fonts = useStore(
    studio.fontManager.store,
    (state) => state.availableFonts,
  );
  const [family, weight, align, vertical, fontStyle] = useStyleCells(provider, [
    "font-family",
    "font-weight",
    "text-align",
    "align-content",
    "font-style",
  ]);
  const currentWeight = weight?.value
    ? String(fontWeightNumber(weight.value))
    : undefined;
  const font = fonts.find((spec) => spec.fontFamily === family?.value);
  const weights = filterMapTruthy(fontWeightOptions, (option) =>
    isValidFontWeight(option.value, font)
      ? option
      : option.value === currentWeight
        ? { ...option, isDisabled: true }
        : false,
  );
  const italic = fontStyle?.value === "italic";

  return (
    <FullRow autoHeight>
      <div className={styles.fields}>
        {animatableOnly && (
          <LabeledStyleColorItem
            label={t("Color")}
            styleName="color"
            vsh={styleHelper}
            isDisabled={readOnly}
            data-test-id="color-selector"
          />
        )}
        {!animatableOnly && (
          <div className={styles.typeface}>
            <LabeledFontFamilySelector
              aria-label={t("Font")}
              styleName="font-family"
              selectOpts={{
                onChange: (value) => {
                  sc.change(() => {
                    provider.targetExp().set("font-family", value);
                  });
                  studio.fontManager.loadFont(studio, value);
                },
                vsh: styleHelper,
              }}
              data-test-id="font-family-selector"
              noMenuButton
              isDisabled={readOnly}
            />
            <LabeledStyleColorItem
              aria-label={t("Text color")}
              displayStyleName={t("Text color")}
              styleName="color"
              colorOpts={{
                "aria-label": t("Text color"),
                leadingIcon: (
                  <FontColorsOutlined
                    className={styles.colorIcon}
                    aria-hidden="true"
                  />
                ),
                popupTitle: t("Text color"),
                className: styles.colorButton,
                floatingPicker: true,
              }}
              vsh={styleHelper}
              isDisabled={readOnly}
              data-test-id="color-selector"
              noMenuButton
              hideIndicator
            />
          </div>
        )}
        <div className={animatableOnly ? styles.pair : styles.fontMetrics}>
          <LabeledStyleSelectItem
            aria-label={t("Weight")}
            displayStyleName={t("Weight")}
            styleName="font-weight"
            textRight={false}
            selectOpts={{ value: currentWeight, options: weights }}
            noMenuButton
            isDisabled={readOnly}
          />
          {!animatableOnly && (
            <TypographyOptions
              name="font-style"
              label="Style"
              options={[["italic", "Italic", ItalicsTrueIcon]]}
              value={italic ? "italic" : ""}
              readOnly={readOnly}
              onChange={() =>
                sc.change(() =>
                  provider
                    .targetExp()
                    .set("font-style", italic ? "normal" : "italic"),
                )
              }
            />
          )}
          <LabeledStyleDimItem
            aria-label={t("Size")}
            displayStyleName={t("Size")}
            styleName="font-size"
            dimOpts={{
              ...tokenTypeDimOpts("FontSize"),
              "data-test-id": "font-size",
              hideArrow: true,
              showDropdownOnFocus: true,
              min: 0,
              onChange: (value) => {
                sc.change(() => {
                  const exp = provider.targetExp();
                  if (value === undefined) {
                    exp.clear("font-size");
                  } else {
                    exp.set("font-size", value);
                  }
                });
                if (value && warnOnRelativeUnits) {
                  const resolved = derefTokenRefs(
                    siteFinalStyleTokensAllDeps(studio.site),
                    value,
                  );
                  const units = parseCssNumericNew(resolved)?.units;
                  if (units && ["em", "%", "rem"].includes(units)) {
                    notification.warning({
                      message: t(
                        "Font size is set in relative units (em, %, rem). This may cause unexpected results when font size is inherited.",
                      ),
                    });
                  }
                }
              },
            }}
            tokenType="FontSize"
            vsh={styleHelper}
            noMenuButton
            isDisabled={readOnly}
          />
        </div>
        <div className={styles.pair}>
          <LabeledStyleDimItem
            label={<Icon icon={LineHeightIcon} aria-hidden="true" />}
            className={styles.metric}
            alignment="center"
            aria-label={t("Line height")}
            displayStyleName={t("Line height")}
            tooltip={t("Line height")}
            labelSize="auto"
            styleName="line-height"
            dimOpts={{
              ...tokenTypeDimOpts("LineHeight"),
              className: styles.metricInput,
              dragScale: "0.1",
              hideArrow: true,
              showDropdownOnFocus: true,
            }}
            tokenType="LineHeight"
            vsh={styleHelper}
            noMenuButton
            isDisabled={readOnly}
          />
          <LabeledStyleDimItem
            label={<Icon icon={LetterSpacingIcon} aria-hidden="true" />}
            className={styles.metric}
            alignment="center"
            aria-label={t("Letter spacing")}
            displayStyleName={t("Letter spacing")}
            tooltip={t("Letter spacing")}
            labelSize="auto"
            styleName="letter-spacing"
            dimOpts={{
              ...tokenTypeDimOpts("Spacing"),
              className: styles.metricInput,
              extraOptions: ["normal"],
              dragScale: "1",
              hideArrow: true,
              showDropdownOnFocus: true,
            }}
            noMenuButton
            isDisabled={readOnly}
          />
        </div>
        {!animatableOnly && (
          <div className={styles.pair}>
            <TypographyOptions
              name="text-align"
              label="Align"
              options={horizontalAlignment}
              value={align?.has ? align.value : "left"}
              readOnly={readOnly}
            />
            <TypographyOptions
              name={verticalAlign ? "align-content" : undefined}
              label="Vertical alignment"
              options={verticalAlignment}
              value={
                vertical?.has && vertical.value !== "normal"
                  ? vertical.value
                  : "start"
              }
              readOnly={readOnly}
              disabledTooltip={
                verticalAlign
                  ? undefined
                  : t("Vertical alignment is available on text layers")
              }
            />
          </div>
        )}
      </div>
    </FullRow>
  );
}

export function TypographySettings({
  inheritableOnly,
  readOnly,
}: {
  inheritableOnly: boolean;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const label = t("Typography settings");
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      title={label}
      content={
        open && (
          <TypographySettingsFields
            inheritableOnly={inheritableOnly}
            readOnly={readOnly}
          />
        )
      }
    >
      <button
        type="button"
        className={styles.settingsButton}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon icon={GridViewIcon} aria-hidden="true" />
      </button>
    </Popover>
  );
}

function TypographySettingsFields({
  inheritableOnly,
  readOnly,
}: React.ComponentProps<typeof TypographySettings>) {
  const { t } = useI18n();
  const sc = useStyleTarget();
  const provider = sc.props.expsProvider;
  const [whiteSpace, overflow, selectable, decoration, casing] = useStyleCells(
    provider,
    [
      "white-space",
      "text-overflow",
      "user-select",
      "text-decoration-line",
      "text-transform",
    ],
  );
  const overflowIndicators = useStyleIndicators(provider, ["overflow"]);
  const overflowBlocked = shouldBeDisabled({
    props: {},
    indicators: overflowIndicators,
    label: t("Overflow"),
  });
  const wraps = whiteSpace?.value !== "nowrap";
  const clearTextOverflow = () => {
    const exp = provider.targetExp();
    if (exp.has("text-overflow") && exp.get("overflow") === "hidden") {
      exp.clear("overflow");
    }
    exp.clear("text-overflow");
  };

  return (
    <div
      className={styles.settings}
      role="dialog"
      aria-label={t("Typography settings")}
    >
      <div className={inheritableOnly ? undefined : styles.format}>
        {!inheritableOnly && (
          <TypographyOptions
            name="text-decoration-line"
            label="Decorate"
            options={[
              ["none", "None", CloseIcon],
              ["underline", "Underline", UnderIcon],
              ["line-through", "Strikethrough", StrikeIcon],
            ]}
            value={decoration?.value || "none"}
            readOnly={readOnly}
          />
        )}
        <TypographyOptions
          name="text-transform"
          label="Text transform"
          options={[
            ["none", "None", CloseIcon],
            ["uppercase", "Uppercase", UpperIcon],
            ["lowercase", "Lowercase", LowerIcon],
            ["capitalize", "Capitalize", CapitalizeIcon],
          ]}
          value={casing?.value || "none"}
          readOnly={readOnly}
        />
      </div>
      <div className={styles.behavior}>
        <TypographyOptions
          name="white-space"
          label="Line wrap"
          options={[["wrap", "Line wrap", WrapIcon]]}
          value={wraps ? "wrap" : ""}
          readOnly={readOnly}
          onChange={() =>
            sc.change(() => {
              provider
                .targetExp()
                .set("white-space", wraps ? "nowrap" : "pre-wrap");
              if (!wraps && !inheritableOnly) {
                clearTextOverflow();
              }
            })
          }
        />
        <TypographyOptions
          name="user-select"
          label="Selectable"
          options={[["text", "Selectable", ItalicsFalseIcon]]}
          value={selectable?.value ?? ""}
          readOnly={readOnly}
          onChange={() =>
            sc.change(() =>
              provider
                .targetExp()
                .set(
                  "user-select",
                  selectable?.value === "text" ? "none" : "text",
                ),
            )
          }
        />
        {!inheritableOnly && (
          <TypographyOptions
            name="text-overflow"
            label="Overflow"
            options={[
              ["overflow", "Visible", AlignRightIcon],
              ["clip", "Clip content", ClipIcon],
              ["ellipsis", "Ellipsis", DotsHorizontalIcon],
            ]}
            value={overflow?.has ? overflow.value : "overflow"}
            readOnly={readOnly || wraps || overflowBlocked.isDisabled}
            disabledTooltip={
              wraps
                ? t(
                    "Line wrap needs to be turned off to set the text overflow options",
                  )
                : overflowBlocked.disabledTooltip
            }
            onChange={(value) =>
              sc.change(() => {
                if (value === "overflow") {
                  clearTextOverflow();
                } else {
                  const exp = provider.targetExp();
                  exp.set("text-overflow", value);
                  exp.set("overflow", "hidden");
                }
              })
            }
          />
        )}
      </div>
    </div>
  );
}
