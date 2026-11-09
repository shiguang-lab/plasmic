import { useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useStylePanelLayoutInputs, useStylePanelLayoutSnapshot } from "@/wab/client/studio-ctx/style-panel-layout-inputs";
import { useStore } from "zustand";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import S from "@/wab/client/components/sidebar-tabs/SizeSection.module.scss";
import {
  FullRow,
  getValueSetState,
  isSetOrInherited,
  LabeledItemRow,
  LabeledStyleDimItem,
  LabeledStyleDimItemRow,
  LabeledStyleSwitchItem,
  SectionSeparator,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import StyleCheckbox from "@/wab/client/components/style-controls/StyleCheckbox";
import {
  ExpsProvider,
  StyleComponentProps,
  StylePanelSection,
  TplExpsProvider,
} from "@/wab/client/components/style-controls/StyleComponent";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { Icon as IconComponent } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { DimManip } from "@/wab/client/DimManip";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  default as PlasmicIcon__Stretch,
  default as StretchIcon,
} from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Stretch";
import {
  default as PlasmicIcon__Wrap,
  default as WrapIcon,
} from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Wrap";
import WidthFullBleedIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WidthFullBleed";
import WidthStandardStretchIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WidthStandardStretch";
import WidthWideIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__WidthWide";
import { tokenTypeDimOpts } from "@/wab/commons/StyleToken";
import { assert, ensure, spawn, withoutNils } from "@/wab/shared/common";
import { isPageComponent } from "@/wab/shared/core/components";
import {
  CONTENT_LAYOUT_FULL_BLEED,
  CONTENT_LAYOUT_WIDE,
  sizeSectionProps,
} from "@/wab/shared/core/style-props";
import {
  isTplComponent,
} from "@/wab/shared/core/tpls";
import { parseAspectRatio } from "@/wab/shared/css/aspect-ratio";
import {
  LENGTH_PERCENTAGE_UNITS,
  LENGTH_UNITS,
  NUMBER_UNITS,
} from "@/wab/shared/css/types";
import { parseDataUrl, SVG_MEDIA_TYPE } from "@/wab/shared/data-urls";
import {
  getPageFrameSizeType,
  setPageSizeType,
} from "@/wab/shared/sizingutils";
import { capitalizeFirst } from "@/wab/shared/strs";
import { $$$ } from "@/wab/shared/TplQuery";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { Alert, Menu } from "antd";
import cn from "classnames";
import React from "react";

function SizeSectionContent(props: StyleComponentProps & { inputs: ReturnType<typeof useStylePanelLayoutSnapshot> }) {
    const { expsProvider, vsh: providedVsh, inputs } = props;
    const uri = inputs.layout?.imageDataUri;
    const svg = !!uri && (uri.search(/\.svg/) !== -1 || parseDataUrl(uri)?.mediaType === SVG_MEDIA_TYPE);
    const minWidth = useStyleIndicators(expsProvider, ["min-width"]);
    const maxWidth = useStyleIndicators(expsProvider, ["max-width"]);
    const minHeight = useStyleIndicators(expsProvider, ["min-height"]);
    const maxHeight = useStyleIndicators(expsProvider, ["max-height"]);
    const aspectRatio = useStyleIndicators(expsProvider, ["aspect-ratio"]);
    const flexGrowShrink = useStyleIndicators(expsProvider, ["flex-grow", "flex-shrink"]);
    const flexBasis = useStyleIndicators(expsProvider, ["flex-basis"]);
    const indicators = { minWidth, maxWidth, minHeight, maxHeight, aspectRatio, flexGrowShrink, flexBasis };
    const dimOpts = { ...tokenTypeDimOpts("Spacing"), min: 0 };
    const currentVsh = useVariantedStylesHelperFromCurrentCtx(providedVsh ? undefined : expsProvider.studioCtx);
    const vsh = providedVsh ?? currentVsh;

    return (
      <StylePanelSection
        expsProvider={expsProvider}
        styleProps={sizeSectionProps}
        title={<UiText message={"Size"} />}
        hasMore
        data-test-id="size-section"
      >
        {(renderMaybeCollapsibleRows) => (
          <div>
            {svg && (
              <Alert
                className="mb-sm"
                type="warning"
                showIcon={true}
                message={
                  <div>
                    <UiText
                      message={
                        "SVGs have no default size, so setting width to hug or auto will cause it to stretch to fill the parent container."
                      }
                    />
                  </div>
                }
              />
            )}
            {renderMaybeCollapsibleRows([
              {
                collapsible: false,
                content: (
                  <FullRow>
                    <SizeControl
                      prop="width"
                      expsProvider={expsProvider}
                      vsh={vsh}
                      // TODO: experimenting with nested content
                      // layout sections that can be resized
                      // isDisabled={
                      //   isDeepContentLayout && isDeepContentLayoutChild
                      // }
                      // disabledTooltip={
                      //   isDeepContentLayout && isDeepContentLayoutChild
                      //     ? "Nested page sections are always full-bleed"
                      //     : undefined
                      // }
                    />
                  </FullRow>
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.minWidth),
                ),
                content: (
                  <FullRow>
                    <LabeledStyleDimItem
                      label={<UiText message={"Min Width"} />}
                      styleName={`min-width`}
                      dimOpts={{
                        ...tokenTypeDimOpts("Spacing"),
                        min: 0,
                        extraOptions: ["auto"],
                      }}
                      tokenType={"Spacing"}
                      vsh={vsh}
                    />
                  </FullRow>
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.maxWidth),
                ),
                content: (
                  <FullRow>
                    <LabeledStyleDimItem
                      label={<UiText message={"Max Width"} />}
                      styleName={`max-width`}
                      dimOpts={{
                        ...tokenTypeDimOpts("Spacing"),
                        min: 0,
                        extraOptions: ["none"],
                      }}
                      tokenType={"Spacing"}
                      vsh={vsh}
                    />
                  </FullRow>
                ),
              },
              {
                collapsible: false,
                content: (
                  <>
                    <SectionSeparator className="mv-m" />
                    <FullRow>
                      <SizeControl
                        prop="height"
                        expsProvider={expsProvider}
                        vsh={vsh}
                      />
                    </FullRow>
                  </>
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.minHeight),
                ),
                content: (
                  <FullRow>
                    <LabeledStyleDimItem
                      label={<UiText message={"Min Height"} />}
                      styleName={`min-height`}
                      dimOpts={{
                        ...tokenTypeDimOpts("Spacing"),
                        min: 0,
                        extraOptions: ["auto"],
                      }}
                      tokenType={"Spacing"}
                      vsh={vsh}
                    />
                  </FullRow>
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.maxHeight),
                ),
                content: (
                  <FullRow>
                    <LabeledStyleDimItem
                      label={<UiText message={"Max Height"} />}
                      styleName={`max-height`}
                      dimOpts={{
                        ...tokenTypeDimOpts("Spacing"),
                        min: 0,
                        extraOptions: ["none"],
                      }}
                      tokenType={"Spacing"}
                      vsh={vsh}
                    />
                  </FullRow>
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.aspectRatio),
                ),
                content: (
                  <FullRow>
                    <LabeledStyleDimItem
                      label={<UiText message={"Aspect Ratio"} />}
                      styleName="aspect-ratio"
                      disabledDragging
                      dimOpts={{
                        allowedUnits: NUMBER_UNITS,
                        extraOptions: ["auto"],
                        disableSpin: true,
                        hideArrow: true,
                        allowFunctions: false,
                        validate: (val) => {
                          const result = parseAspectRatio(val);
                          if ("aspectRatio" in result) {
                            return { valid: true };
                          }
                          return {
                            valid: false,
                            error:
                              'Must be "auto", a decimal (1.5), or fraction (16/9)',
                          };
                        },
                        transform: (val) => {
                          const result = parseAspectRatio(val);
                          return "aspectRatio" in result
                            ? result.aspectRatio
                            : val;
                        },
                      }}
                      vsh={vsh}
                    />
                  </FullRow>
                ),
              },
              {
                collapsible:
                  !isSetOrInherited(
                    getValueSetState(
                      ...indicators.flexGrowShrink,
                    ),
                  ) &&
                  !isSetOrInherited(
                    getValueSetState(...indicators.flexBasis),
                  ),
                content: <SectionSeparator className="mv-m" />,
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(
                    ...indicators.flexGrowShrink,
                  ),
                ),
                content: (
                  <FlexGrowControls expsProvider={expsProvider} />
                ),
              },
              {
                collapsible: !isSetOrInherited(
                  getValueSetState(...indicators.flexBasis),
                ),
                content: (
                  <LabeledStyleDimItemRow
                    label={<UiText message={"Flex basis"} />}
                    styleName="flex-basis"
                    dimOpts={{
                      ...dimOpts,
                      extraOptions: ["auto"],
                    }}
                    tokenType={"Spacing"}
                    vsh={vsh}
                    definedIndicator={indicators.flexBasis}
                  />
                ),
              },
            ])}
          </div>
        )}
      </StylePanelSection>
    );
}

const sizeKeys = [...sizeSectionProps, "display", "flex-direction"];
export const SizeSection = React.memo(function SizeSection(props: StyleComponentProps) {
  const inputs = useStylePanelLayoutSnapshot(props.expsProvider, sizeKeys, ["display", "flex-direction"]);
  return inputs.active ? <SizeSectionContent {...props} inputs={inputs} /> : null;
});

export const SizeWidthOnlySection = function SizeWidthOnlySection(
  props: StyleComponentProps,
) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;
  const studioCtx = expsProvider.studioCtx;
  const contextVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studioCtx);
  const vsh = props.vsh ?? contextVsh;
  return (
    <StylePanelSection
      expsProvider={expsProvider}
      styleProps={["width"]}
      title={uiT("Size")}
      data-test-id="size-width-section"
    >
      <FullRow>
        <SizeControl prop="width" expsProvider={expsProvider} vsh={vsh} />
      </FullRow>
    </StylePanelSection>
  );
};

const SizeControl = React.memo(function SizeRow(props: {
  prop: "width" | "height";
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
  isDisabled?: boolean;
  disabledTooltip?: React.ReactNode;
}) {
  const { t: uiT } = useI18n();
  const {
    prop,
    expsProvider,
    isDisabled,
    disabledTooltip,
    vsh: _vshInput,
  } = props;
  const vsh = _vshInput === undefined ? (new VariantedStylesHelper()) : _vshInput;
  useViewVariants(expsProvider instanceof TplExpsProvider ? expsProvider.viewCtx : undefined, useShallow((variantState) => [variantState.frames, variantState.global]));
  const inputs = useStylePanelLayoutSnapshot(expsProvider, sizeKeys, ["display", "flex-direction"]);
  const cell = inputs.cells.find((item) => item.key === prop);
  if (!inputs.active || !cell) { return null; }
  const value = cell.value;
  const tpl =
    expsProvider instanceof TplExpsProvider ? expsProvider.tpl : undefined;
  const canSetSpecialSizes = !!tpl;

  const sc = expsProvider.studioCtx;

  const metadata = inputs.layout;
  const isAutoSizable = metadata ? (prop === "width" ? metadata.canAutoSizeWidth : metadata.canAutoSizeHeight) : true;
  const isResizable = metadata ? (prop === "width" ? metadata.canResizeWidth : metadata.canResizeHeight) : true;
  const isRoot = metadata?.isRoot ?? false;
  const isDeepContentLayoutChild = !!metadata && (metadata.parentIsContentLayout || metadata.isRoot);

  const stretchLabel =
    prop === "width" && isDeepContentLayoutChild && !isRoot
      ? uiT("Standard width")
      : uiT("Stretch");
  const fullBleedLabel = isRoot
    ? uiT("Stretch (full bleed)")
    : uiT("Full bleed");
  const wideLabel = isRoot ? uiT("Stretch (wide)") : uiT("Wide");
  const extraOptions = canSetSpecialSizes
    ? withoutNils([
        {
          value: "wrap",
          disabled: !isAutoSizable || value === "wrap",
          cleanLabel: "hug content",
          label: (
            <div className={S.extraOptionWrapper}>
              <IconComponent
                icon={WrapIcon}
                style={{
                  transform: prop === "height" ? "rotate(-90deg)" : undefined,
                }}
              />
              <UiText message={"Hug content"} />
            </div>
          ),
        },
        {
          value: "stretch",
          disabled: value === "stretch",
          cleanLabel: stretchLabel,
          label: (
            <div className={S.extraOptionWrapper}>
              <IconComponent
                icon={
                  prop === "width" && isDeepContentLayoutChild
                    ? WidthStandardStretchIcon
                    : StretchIcon
                }
                style={{
                  transform: prop === "height" ? "rotate(-90deg)" : undefined,
                }}
              />
              {stretchLabel}
            </div>
          ),
        },
        ...(prop === "width" && isDeepContentLayoutChild
          ? [
              {
                value: CONTENT_LAYOUT_WIDE,
                disabled: !isAutoSizable || value === CONTENT_LAYOUT_WIDE,
                cleanLabel: wideLabel,
                label: (
                  <div className={S.extraOptionWrapper}>
                    <IconComponent icon={WidthWideIcon} />
                    {wideLabel}
                  </div>
                ),
              },
              {
                value: CONTENT_LAYOUT_FULL_BLEED,
                disabled: !isAutoSizable || value === CONTENT_LAYOUT_FULL_BLEED,
                cleanLabel: fullBleedLabel,
                label: (
                  <div className={S.extraOptionWrapper}>
                    <IconComponent icon={WidthFullBleedIcon} />
                    {fullBleedLabel}
                  </div>
                ),
              },
            ]
          : []),
        {
          value: "max-content",
          hide: true,
        },
        isTplComponent(tpl)
          ? {
              value: "default",
              label: uiT("Default"),
            }
          : undefined,
      ])
    : ([] as any[]);

  const setProp = (val: string | undefined) => {
    const owner = expsProvider.getNativeStyleSource().inputs;
    if (owner.isDisposed || (expsProvider instanceof TplExpsProvider && !expsProvider.canEdit())) { return; }
    spawn(
      sc.changeUnsafe(() => {
        if (owner.isDisposed || (expsProvider instanceof TplExpsProvider && !expsProvider.canEdit())) { return; }
        const exp = expsProvider.targetExp();
        if (val == null) {
          exp.clear(prop);
        } else {
          exp.set(prop, val);
          if (isDeepContentLayoutChild && prop === "width" && val === "wrap") {
            // If setting to hug content, then as content layout child,
            // we also need to set justify-self, otherwise by default,
            // the parent will be stretching us
            exp.set("justify-self", "flex-start");
          }
        }
      }),
    );
  };

  return (
    <LabeledStyleDimItem
      label={capitalizeFirst(prop)}
      className={S.dimField}
      styleName={prop}
      initialMenuItems={() =>
        new DimManip(
          expsProvider.studioCtx,
          expsProvider.forDom(),
          expsProvider.mergedExp,
          prop,
        ).renderConvertMenuItems()
      }
      disabledTooltip={disabledTooltip}
      rightExtras={
        !isDisabled && (
          <div className={S.toggleIcons}>
            {value !== "stretch" && (
              <IconButton
                size="small"
                type="clear"
                tooltip={
                  isDeepContentLayoutChild && prop === "width"
                    ? uiT("Stretch standard")
                    : uiT("Stretch")
                }
                onClick={() => setProp("stretch")}
                className={cn(S.toggleSizingIcon, {
                  [S.toggleSizingIcon__height]: prop === "height",
                })}
              >
                <IconComponent
                  icon={
                    isDeepContentLayoutChild && prop === "width"
                      ? WidthStandardStretchIcon
                      : PlasmicIcon__Stretch
                  }
                />
              </IconButton>
            )}
            {value !== "wrap" && value !== "auto" && (
              <IconButton
                size="small"
                type="clear"
                tooltip={uiT("Hug content")}
                onClick={() => setProp("wrap")}
                className={cn(S.toggleSizingIcon, {
                  [S.toggleSizingIcon__height]: prop === "height",
                })}
              >
                <IconComponent icon={PlasmicIcon__Wrap} />
              </IconButton>
            )}
            {prop === "width" && isDeepContentLayoutChild && !isRoot && (
              <>
                {value !== CONTENT_LAYOUT_WIDE && (
                  <IconButton
                    size="small"
                    type="clear"
                    tooltip={uiT("Stretch wide")}
                    onClick={() => setProp(CONTENT_LAYOUT_WIDE)}
                    className={S.toggleSizingIcon}
                  >
                    <IconComponent icon={WidthWideIcon} />
                  </IconButton>
                )}
                {value !== CONTENT_LAYOUT_FULL_BLEED && (
                  <IconButton
                    size="small"
                    type="clear"
                    tooltip={uiT("Stretch full bleed")}
                    onClick={() => setProp(CONTENT_LAYOUT_FULL_BLEED)}
                    className={S.toggleSizingIcon}
                  >
                    <IconComponent icon={WidthFullBleedIcon} />
                  </IconButton>
                )}
              </>
            )}
          </div>
        )
      }
      dimOpts={{
        disabled: isDisabled || !isResizable,
        extraOptions,
        value: toDisplay(value, stretchLabel, isRoot),
        onChange: (val) => setProp(val),
        min: 0,
        // Cannot specify a root in %
        allowedUnits: isRoot ? LENGTH_UNITS : LENGTH_PERCENTAGE_UNITS,
        allowFunctions: true,
        hideArrow: true,
      }}
      tokenType={"Spacing"}
      vsh={vsh}
      isDisabled={isDisabled}
      hideIndicator={isDisabled}
    />
  );
});

const FlexGrowControls = React.memo(function FlexGrowControls(props: {
  expsProvider: ExpsProvider;
}) {
  const indicators = useStyleIndicators(props.expsProvider, ["flex-grow", "flex-shrink"]);
  const inputs = useStylePanelLayoutSnapshot(props.expsProvider, ["flex-grow", "flex-shrink", "flex-basis", "width", "height", "position"], ["display", "flex-direction"]);
  const usePlasmicImg = useStore(props.expsProvider.studioCtx.uiEnvironment.store, (state) => state.usePlasmicImg);
  if (!inputs.active || !inputs.cells.length) { return null; }
  const { isDisabled } = shouldBeDisabled({
    props: {},
    indicators,
  });

  const { expsProvider } = props;
  const owner = expsProvider.getNativeStyleSource().inputs;

  const parentContainerType = inputs.parentContainerType;

  const exp = () => expsProvider.mergedExp();

  const getFlexShrinkVal = (prop: "flex-shrink") => {
    const cell = inputs.cells.find((item) => item.key === prop);
    if (cell?.has) { return cell.value; }

    return usePlasmicImg &&
      inputs.layout?.isImage
      ? false
      : true;
  };

  // Now we know we are in a flex parent that is auto-positioned

  const renderSizing = (
    prop: "flex-grow" | "flex-shrink",
    title: string,
    tooltip: string,
  ) => {
    const val = prop == "flex-grow" ? ensure(inputs.cells.find((item) => item.key === prop), "Flex sizing requires its captured CSS cell").value : getFlexShrinkVal(prop);
    const isNonzero = +val > 0;
    const strVal = `${+val}`;

    return (
      <LabeledStyleSwitchItem
        tooltip={tooltip}
        label={title}
        styleName={prop}
        value={isNonzero}
        data-plasmic-prop={prop}
        onChange={(checked) => {
          if (isDisabled || owner.isDisposed) {
            return;
          }
          spawn(
            expsProvider.studioCtx.changeUnsafe(() => {
              if (owner.isDisposed) { return; }
              exp().set(prop, checked ? "1" : "0");
            }),
          );
        }}
        valueSlot={
          <EditableLabel
            value={strVal}
            labelFactory={({ className, ...restProps }) => (
              <div
                className={cn(
                  { dimfg: +val === 0 || +val === 1 },
                  "code",
                  "pointer",
                  className,
                )}
                {...restProps}
              />
            )}
            disabled={isDisabled}
            inputBoxFactory={(inputProps) => (
              <input {...inputProps} autoFocus type="number" min="0" />
            )}
            onEdit={(value) => {
              if (owner.isDisposed) { return false; }
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0) {
                spawn(
                  expsProvider.studioCtx.changeUnsafe(() => {
                    if (owner.isDisposed) { return; }
                    exp().set(prop, String(num));
                  }),
                );
                return true;
              }
              return false;
            }}
          />
        }
      />
    );
  };

  return (
    <>
      <FullRow>
        {renderSizing("flex-grow", "Grow", "Grow to fill available space")}
      </FullRow>
      <FullRow>
        {renderSizing("flex-shrink", "Shrink", "Shrink if not enough space")}
      </FullRow>
    </>
  );
});

function toDisplay(val: string, stretchLabel: string, isRoot: boolean) {
  if (val === "wrap") {
    val = "Hug content";
  } else if (val === CONTENT_LAYOUT_FULL_BLEED) {
    val = "Full bleed";
    if (isRoot) {
      val = `Stretch (${val.toLowerCase()})`;
    }
  } else if (val === CONTENT_LAYOUT_WIDE) {
    val = "Wide";
    if (isRoot) {
      val = `Stretch (${val.toLowerCase()})`;
    }
  } else if (val === "stretch") {
    val = stretchLabel;
  }
  return val;
}

function fromDisplay(val: string, stretchLabel: string) {
  if (val === "Hug content") {
    val = "wrap";
  } else if (val === "Full bleed") {
    val = CONTENT_LAYOUT_FULL_BLEED;
  } else if (val === "Wide width") {
    val = CONTENT_LAYOUT_WIDE;
  } else if (val === stretchLabel) {
    val = "stretch";
  }
  return val;
}

export const PageSizePanelSection = React.memo(
  function PageSizePanelSection(props: { expsProvider: ExpsProvider }) {
    const { t: uiT } = useI18n();
    const { expsProvider } = props;
    assert(
      expsProvider instanceof TplExpsProvider,
      "ExpsProvider should be TplExpsProvider",
    );
    useViewSelection(expsProvider.viewCtx, (state) => state.context);
    const active = useStylePanelLayoutInputs(expsProvider, sizeKeys);
    if (!active) { return null; }
    const component = expsProvider.viewCtx.currentComponent();
    const arenaFrame = expsProvider.viewCtx.arenaFrame();
    assert(
      isPageComponent(component),
      "Section should only be shown to Page Components",
    );
    const sizeType = getPageFrameSizeType(arenaFrame);
    return (
      <SidebarSection title={uiT("Size")}>
        {
          // Using LabeleditemRow instead of LabeledStyleCheckboxItem
          // because we are carefully managing the height style, unlike
          // a normal height style prop; we don't want users to be able
          // to unset it, and the usual defined indicators also are
          // not helpful.
        }
        <WithContextMenu
          overlay={() => (
            <Menu>
              {sizeType === "wrap" ? (
                <Menu.Item
                  onClick={() =>
                    expsProvider.studioCtx.changeUnsafe(() => {
                      setPageSizeType(component, "stretch");
                    })
                  }
                >
                  <UiText message={"Let page height fill the browser window"} />
                </Menu.Item>
              ) : (
                <Menu.Item
                  onClick={() =>
                    expsProvider.studioCtx.changeUnsafe(() => {
                      setPageSizeType(component, "wrap");
                    })
                  }
                >
                  <UiText message={"Let page height hug content instead"} />
                </Menu.Item>
              )}
            </Menu>
          )}
        >
          <div>
            {sizeType === "wrap" ? (
              <UiText message={"Page height hugs page content"} />
            ) : (
              <UiText message={"Page height fills up the browser window"} />
            )}
          </div>
        </WithContextMenu>
        {sizeType !== "wrap" && (
          <LabeledItemRow>
            <StyleCheckbox
              isChecked={sizeType === "fixed"}
              onChange={(val) =>
                expsProvider.studioCtx.changeUnsafe(() => {
                  setPageSizeType(component, val ? "fixed" : "stretch");
                })
              }
              valueSetState={sizeType === "fixed" ? "isSet" : undefined}
              tooltip={
                <>
                  <UiText
                    message={
                      "If your page has scrollable containers inside, you can fix the page height to the window height, so that the window does not scroll."
                    }
                  />
                </>
              }
            >
              <UiText message={"Fix page height to window height"} />
            </StyleCheckbox>
          </LabeledItemRow>
        )}
      </SidebarSection>
    );
  },
);

export const StretchyComponentSizePanelSection = 
  function StretchyComponentSizePanelSection(props: {
    expsProvider: ExpsProvider;
  }) {
    const { t: uiT } = useI18n();
    const { expsProvider } = props;
    assert(
      expsProvider instanceof TplExpsProvider,
      "ExpsProvider should be TplExpsProvider",
    );

    return (
      <SidebarSection title={uiT("Size")}>
        <div>
          <UiText
            message={"Stretchy components take up the entire artboard."}
          />
        </div>
        <FullRow>
          <SizeControl
            prop="width"
            expsProvider={props.expsProvider}
            isDisabled={true}
            disabledTooltip={uiT("Cannot modify width in stretch view mode")}
          />
        </FullRow>
        <FullRow>
          <SizeControl prop="height" expsProvider={props.expsProvider} />
        </FullRow>
      </SidebarSection>
    );
  }
;

