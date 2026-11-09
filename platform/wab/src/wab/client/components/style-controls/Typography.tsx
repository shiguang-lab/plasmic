import {
  FullRow,
  getValueSetState,
  isSetOrInherited,
  LabeledFontFamilySelector,
  LabeledStyleColorItemRow,
  LabeledStyleDimItem,
  LabeledStyleSelectItem,
  LabeledStyleSwitchItem,
  LabeledToggleButtonGroup,
  StyleSelectOption,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { MaybeCollapsibleRowsRenderer } from "@/wab/client/components/sidebar/SidebarSection";
import {
  useStyleTarget,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells, useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import type { FontInstallSpec } from "@/wab/shared/fonts";
import { useStore } from "zustand";

import AlignCenterIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__AlignCenter";
import AlignLeftIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__AlignLeft";
import AlignRightIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__AlignRight";
import CapitalizeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Capitalize";
import ClipIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Clip";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import ItalicsFalseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ItalicsFalse";
import ItalicsTrueIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ItalicsTrue";
import JustifyIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Justify";
import LowerIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Lower";
import StrikeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Strike";
import UnderIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Under";
import UpperIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Upper";
import DotsHorizontalIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__DotsHorizontal";
import {
  fontWeightOptions,
  isValidFontWeight,
} from "@/wab/client/typography-utils";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { derefTokenRefs, tokenTypeDimOpts } from "@/wab/commons/StyleToken";
import { ensure, filterMapTruthy, maybe } from "@/wab/shared/common";
import { siteFinalStyleTokensAllDeps } from "@/wab/shared/core/site-style-tokens";
import { fontWeightNumber, parseCssNumericNew } from "@/wab/shared/css";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { notification } from "antd";
import * as React from "react";
import { ReactElement } from "react";

interface TypographyContentProps {
  onChange: (cssPropName: string, newValue: string) => void;
  unset: (cssPropName: string) => void;
  showMore?: boolean;
  showMoreButton?: ReactElement;
  renderMaybeCollapsibleRows: MaybeCollapsibleRowsRenderer;
  inheritableOnly: boolean;
  vsh?: VariantedStylesHelper;
  warnOnRelativeUnits?: boolean;
  readOnly?: boolean;
  animatableOnly?: boolean;
}

export const Typography = TypographyContent;

function mkFontWeightOptions(
  fonts: readonly FontInstallSpec[],
  fontFamily: string,
  currentFontWeight: string | undefined,
): StyleSelectOption[] {
  // For Google fonts, where only certain variants are valid,
  // only show those variants
  const spec = fonts.find((font) => font.fontFamily === fontFamily);

  return filterMapTruthy(fontWeightOptions, (option) =>
    isValidFontWeight(option.value, spec)
      ? option
      : option.value == currentFontWeight
        ? // font-weight is set to a value that is not supported by this font. In
          // this case, we want to show the current value for font-weight in the
          // options, but disabled.
          { ...option, isDisabled: true }
        : false,
  );
}

function TypographyContent({
  renderMaybeCollapsibleRows,
  inheritableOnly,
  readOnly,
  animatableOnly,
  ...props
}: TypographyContentProps) {
  const { t: uiT } = useI18n();
  const sc = useStyleTarget();
  const fonts = useStore(
    sc.studioCtx().fontManager.store,
    (state) => state.availableFonts,
  );
  const expsProvider = sc.props.expsProvider;
  const [
    fontFamilyCell,
    fontWeightCell,
    userSelectCell,
    whiteSpaceCell,
    textOverflowCell,
  ] = useStyleCells(expsProvider, [
    "font-family",
    "font-weight",
    "user-select",
    "white-space",
    "text-overflow",
  ]);
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : sc.studioCtx());
  const vsh = props.vsh ?? currentVsh;
  const spacingIndicators = useStyleIndicators(expsProvider, ["line-height", "letter-spacing"]);
  const selectableIndicators = useStyleIndicators(expsProvider, ["user-select", "text-transform"]);
  const whiteSpaceIndicators = useStyleIndicators(expsProvider, ["white-space"]);

  const currentFontWeight = maybe(
    fontWeightCell?.value,
    (x) => `${fontWeightNumber(x)}`,
  );

  return (
    <>
      <LabeledStyleColorItemRow
        label={uiT("Color")}
        styleName="color"
        vsh={vsh}
        data-test-id="color-selector"
      />
      {!animatableOnly && (
        <FullRow>
          <LabeledFontFamilySelector
            label={uiT("Font")}
            styleName="font-family"
            selectOpts={{
              onChange: (val) => props.onChange("font-family", val),
              vsh,
            }}
            data-test-id="font-family-selector"
            isDisabled={readOnly}
          />
        </FullRow>
      )}
      <FullRow>
        <LabeledStyleSelectItem
          styleName={"font-weight"}
          tooltip={uiT("Font weight (boldness)")}
          label={uiT("Weight")}
          textRight={false}
          selectOpts={{
            value: currentFontWeight,
            onChange: (val) => props.onChange("font-weight", `${val}`),
            options: mkFontWeightOptions(fonts, fontFamilyCell?.value ?? "", currentFontWeight),
          }}
          isDisabled={readOnly}
        />
      </FullRow>
      <FullRow>
        <LabeledStyleDimItem
          label={uiT("Size")}
          styleName="font-size"
          dimOpts={{
            ...tokenTypeDimOpts("FontSize"),
            "data-test-id": "font-size",
            dragScale: "1",
            min: 0,
            onChange: (val) => {
              sc.change(() => {
                if (val === undefined) {
                  sc.exp().clear("font-size");
                } else {
                  sc.exp().set("font-size", val);
                }
              });

              if (props.warnOnRelativeUnits) {
                if (val) {
                  const derefedVal = derefTokenRefs(
                    siteFinalStyleTokensAllDeps(sc.studioCtx().site),
                    val,
                  );
                  const parsed = parseCssNumericNew(derefedVal);
                  if (
                    parsed?.units &&
                    ["em", "%", "rem"].includes(parsed.units)
                  ) {
                    notification.warning({
                      message: uiT(
                        "Font size is set in relative units (em, %, rem). This may cause unexpected results when font size is inherited.",
                      ),
                    });
                  }
                }
              }
            },
          }}
          tokenType={"FontSize"}
          vsh={vsh}
          isDisabled={readOnly}
        />
      </FullRow>

      {!animatableOnly && (
        <>
          <FullRow>
            <LabeledToggleButtonGroup
              styleName="text-align"
              label={uiT("Align")}
              autoWidth
              isDisabled={readOnly}
            >
              <StyleToggleButton value="left" tooltip={uiT("Align left")}>
                <Icon icon={AlignLeftIcon} />
              </StyleToggleButton>
              <StyleToggleButton value="center" tooltip={uiT("Align center")}>
                <Icon icon={AlignCenterIcon} />
              </StyleToggleButton>
              <StyleToggleButton value="right" tooltip={uiT("Align right")}>
                <Icon icon={AlignRightIcon} />
              </StyleToggleButton>
              <StyleToggleButton value="justify" tooltip={uiT("Justify")}>
                <Icon icon={JustifyIcon} />
              </StyleToggleButton>
            </LabeledToggleButtonGroup>
          </FullRow>
          <FullRow>
            <LabeledToggleButtonGroup
              styleName="font-style"
              label={uiT("Style")}
              autoWidth
              isDisabled={readOnly}
            >
              <StyleToggleButton value="normal">
                <Icon icon={ItalicsFalseIcon} />
              </StyleToggleButton>
              <StyleToggleButton value="italic">
                <Icon icon={ItalicsTrueIcon} />
              </StyleToggleButton>
            </LabeledToggleButtonGroup>
          </FullRow>
        </>
      )}
      {!inheritableOnly && !animatableOnly && (
        <FullRow>
          <LabeledToggleButtonGroup
            styleName="text-decoration-line"
            label={uiT("Decorate")}
            autoWidth
            isDisabled={readOnly}
            data-test-id="text-decoration-selector"
          >
            <StyleToggleButton value="underline">
              <Icon icon={UnderIcon} />
            </StyleToggleButton>
            <StyleToggleButton value="line-through">
              <Icon icon={StrikeIcon} />
            </StyleToggleButton>
            <StyleToggleButton value="none">
              <Icon icon={CloseIcon} />
            </StyleToggleButton>
          </LabeledToggleButtonGroup>
        </FullRow>
      )}
      {/* Show letter spacing and line height controls without collapsable section */}
      {animatableOnly && (
        <LetterSpacingLineHeightControls readOnly={readOnly} vsh={vsh} />
      )}
      {!animatableOnly &&
        renderMaybeCollapsibleRows([
          {
            collapsible: !isSetOrInherited(
              getValueSetState(
                ...spacingIndicators,
              ),
            ),
            content: (
              <LetterSpacingLineHeightControls readOnly={readOnly} vsh={vsh} />
            ),
          },
          {
            collapsible: !isSetOrInherited(
              getValueSetState(
                ...selectableIndicators,
              ),
            ),
            content: (
              <>
                <FullRow>
                  <LabeledStyleSwitchItem
                    label={uiT("Selectable")}
                    styleName="user-select"
                    value={userSelectCell?.value === "text"}
                    onChange={(val) => {
                      props.onChange("user-select", val ? "text" : "none");
                    }}
                    isDisabled={readOnly}
                  />
                </FullRow>
                <FullRow>
                  <LabeledToggleButtonGroup
                    label={uiT("Text transform")}
                    styleName="text-transform"
                    autoWidth
                    isDisabled={readOnly}
                  >
                    <StyleToggleButton value="uppercase">
                      <Icon icon={UpperIcon} />
                    </StyleToggleButton>
                    <StyleToggleButton value="capitalize">
                      <Icon icon={CapitalizeIcon} />
                    </StyleToggleButton>
                    <StyleToggleButton value="lowercase">
                      <Icon icon={LowerIcon} />
                    </StyleToggleButton>
                    <StyleToggleButton value="none">
                      <Icon icon={CloseIcon} />
                    </StyleToggleButton>
                  </LabeledToggleButtonGroup>
                </FullRow>
              </>
            ),
          },
          {
            collapsible: !isSetOrInherited(
              getValueSetState(...whiteSpaceIndicators),
            ),
            content: (
              <>
                <FullRow>
                  <LabeledStyleSwitchItem
                    label={uiT("Line wrap")}
                    styleName="white-space"
                    value={whiteSpaceCell?.value !== "nowrap"}
                    onChange={(val) => {
                      props.onChange(
                        "white-space",
                        val ? "pre-wrap" : "nowrap",
                      );
                      if (val) {
                        props.unset("text-overflow");
                        props.unset("overflow");
                      }
                    }}
                    isDisabled={readOnly}
                  />
                </FullRow>

                <FullRow>
                  <LabeledToggleButtonGroup
                    label={uiT("Overflow")}
                    styleName="text-overflow"
                    isDisabled={readOnly || whiteSpaceCell?.value !== "nowrap"}
                    disabledTooltip={uiT(
                      "Line wrap needs to be turned off to set the text overflow options",
                    )}
                    value={
                      textOverflowCell?.has
                        ? textOverflowCell?.value
                        : "overflow"
                    }
                    onChange={(val) =>
                      sc.change(() => {
                        if (val === "overflow") {
                          props.unset("text-overflow");
                          props.unset("overflow");
                        } else {
                          props.onChange(
                            "text-overflow",
                            ensure(
                              val,
                              "Unexpected undefined text-overflow value",
                            ),
                          );
                          props.onChange("overflow", "hidden");
                        }
                      })
                    }
                    autoWidth
                  >
                    <StyleToggleButton value="ellipsis">
                      <Icon icon={DotsHorizontalIcon} />
                    </StyleToggleButton>
                    <StyleToggleButton value="clip">
                      <Icon icon={ClipIcon} />
                    </StyleToggleButton>
                    {/*
                    overflow" is not an actual value for text-overflow.
                    rather it's used to signal to unset "text-overflow" and "overflow"
                  */}
                    <StyleToggleButton value="overflow">
                      <Icon icon={CloseIcon} />
                    </StyleToggleButton>
                  </LabeledToggleButtonGroup>
                </FullRow>
              </>
            ),
          },
        ])}
    </>
  );
}

function LetterSpacingLineHeightControls({
  readOnly,
  vsh,
}: {
  readOnly?: boolean;
  vsh?: VariantedStylesHelper;
}) {
  const { t: uiT } = useI18n();
  return (
    <>
      <FullRow>
        <LabeledStyleDimItem
          styleName={"line-height"}
          label={uiT("Line height")}
          dimOpts={{
            ...tokenTypeDimOpts("LineHeight"),
            dragScale: "0.1",
          }}
          tokenType={"LineHeight"}
          vsh={vsh}
          isDisabled={readOnly}
        />
      </FullRow>
      <FullRow>
        <LabeledStyleDimItem
          label={uiT("Letter spacing")}
          styleName={"letter-spacing"}
          dimOpts={{
            ...tokenTypeDimOpts("Spacing"),
            extraOptions: ["normal"],
            dragScale: "1",
          }}
          isDisabled={readOnly}
        />
      </FullRow>
    </>
  );
}
