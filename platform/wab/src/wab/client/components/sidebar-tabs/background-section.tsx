import { StyleOverrideControl } from "@/wab/client/components/style-controls/StyleOverrideMenu";
import { EllipseControl } from "@/wab/client/components/EllipseControl";
import { useBackgroundInputs } from "@/wab/client/studio-ctx/background-inputs";
import { useImageAssetList } from "@/wab/client/studio-ctx/image-asset-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useMaybeSidebarModalContext } from "@/wab/client/components/sidebar/SidebarModal";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import styles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import {
  FullRow,
  LabeledItem,
  LabeledItemRow,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { AngleDial } from "@/wab/client/components/style-controls/AngleDial";
import { ColorStops } from "@/wab/client/components/style-controls/ColorStops";
import { ImageAssetPreviewAndPicker } from "@/wab/client/components/style-controls/ImageSelector";
import { PosControls2 } from "@/wab/client/components/style-controls/PosControls";
import {
  ExpsProvider,
  StylePanelSection,
  TabbedStylePanelSection,
  changeStyle,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells, useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
import StyleSelect from "@/wab/client/components/style-controls/StyleSelect";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import StyleToggleButtonGroup from "@/wab/client/components/style-controls/StyleToggleButtonGroup";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { UnloggedDragCatcher } from "@/wab/client/components/style-controls/UnloggedDragCatcher";
import * as widgets from "@/wab/client/components/widgets";
import { ColorPicker } from "@/wab/client/components/widgets/ColorPicker";
import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import IconButton from "@/wab/client/components/widgets/IconButton";
import { useI18n } from "@/wab/client/i18n";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { UiText } from "@/wab/client/i18n/UiText";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import ContainIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Contain";
import CoverIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Cover";
import ImageBlockIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__ImageBlock";
import LinearIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Linear";
import RadialIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Radial";
import RepeatGridIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RepeatGrid";
import RepeatHIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__RepeatH";
import PaintBucketFillIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__PaintBucketFill";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { arrayMoveIndex } from "@/wab/shared/collections";
import {
  assert,
  ensure,
  maybe,
  switchType,
  unexpected,
} from "@/wab/shared/common";
import { isTokenRef } from "@/wab/commons/StyleToken";
import {
  Background,
  BackgroundLayer,
  ColorFill,
  ImageBackground,
  LinearGradient,
  NoneBackground,
  RadialGradient,
  Stop,
  bgClipTextTag,
  mkBackgroundLayer,
} from "@/wab/shared/core/bg-styles";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import {
  mkImageAssetRef,
  extractAllAssetRefs,
} from "@/wab/shared/core/image-assets";
import * as css from "@/wab/shared/css";
import { parseCss } from "@/wab/shared/css";
import {
  LENGTH_PERCENTAGE_UNITS,
  PERCENTAGE_UNITS,
} from "@/wab/shared/css/types";
import { isStandardSide, oppSides } from "@/wab/shared/geom";
import { isKnownImageAsset } from "@/wab/shared/model/classes";
import { userImgUrl } from "@/wab/shared/urls";
import Chroma from "@/wab/shared/utils/color-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { cloneDeep } from "lodash";
import { InputNumber, Popover, Tooltip } from "antd";
import React, { useState } from "react";

interface BackgroundProps {
  expsProvider: ExpsProvider;
  vsh?: VariantedStylesHelper;
  animatableOnly?: boolean;
}

export const BackgroundSection = function BackgroundSection(
  props: BackgroundProps,
) {
  const { t: uiT } = useI18n();
  const { expsProvider, animatableOnly } = props;
  const { studioCtx } = expsProvider;
  const [backgroundCell] = useStyleCells(expsProvider, ["background"]);
  const bg = parseCss(backgroundCell?.raw ?? "", {
    startRule: "background",
  });
  bg.filterNoneLayers(); // Case of `background: none`

  const [inspected, setInspected] = useState<number>();
  const currentVsh = useVariantedStylesHelperFromCurrentCtx(props.vsh ? undefined : studioCtx);
  const vsh = props.vsh ?? currentVsh;
  const backgroundIndicator = useStyleIndicator(expsProvider, "background");
  const { labels, thumbnails, solidColors } = useBackgroundInputs(studioCtx, bg.layers, vsh);

  const updateLayers = (update: (layers: BackgroundLayer[]) => BackgroundLayer[]) => {
    changeStyle(expsProvider, () => {
      const exp = expsProvider.mergedExp();
      const latest = parseCss(exp.getRaw("background") ?? "", { startRule: "background" });
      latest.filterNoneLayers();
      const layers = update(latest.layers);
      assert(
        layers.every((layer) => !layer.preferBackgroundColorOverColorFill),
        "No background layer can have a preferBackgroundColorOverColorFill",
      );
      if (layers.length > 0) {
        exp.set("background", new Background({ layers }).showCss());
      } else if (expsProvider.maybeTargetExp()?.has("background")) {
        exp.clear("background");
      } else if (latest.layers.length > 0) {
        // Removing an inherited layer explicitly suppresses that fill.
        exp.set("background", "none");
      }
    });
  };

  const moveLayer = (fromIndex: number, toIndex: number) => {
    setInspected(undefined);
    updateLayers((layers) => arrayMoveIndex(layers, fromIndex, toIndex));
  };

  const removeLayer = (index: number) => {
    setInspected(undefined);
    updateLayers((layers) => layers.filter((_, i) => i !== index));
  };

  const changeLayerAlpha = (index: number, alpha: number) => {
    updateLayers((layers) => layers.map((layer, layerIndex) => {
      if (
        layerIndex !== index ||
        !(layer.image instanceof ColorFill) ||
        isTokenRef(layer.image.color) ||
        !Chroma.valid(layer.image.color)
      ) {
        return layer;
      }
      return new BackgroundLayer({
        ...layer,
        image: new ColorFill({ color: Chroma(layer.image.color).alpha(alpha).hex() }),
      });
    }));
  };

  const addFill = () => {
    setInspected(undefined);
    updateLayers((layers) => [
      mkBackgroundLayer(parseCss(defaultValuesByBgType.fill, { startRule: "backgroundImage" })),
      ...layers,
    ]);
  };

  const { isDisabled } = shouldBeDisabled({
    props: {},
    indicators: [backgroundIndicator],
  });

  const isSet = bg.layers.length > 0;

  return (
    <StylePanelSection
      key={String(isSet)}
      expsProvider={expsProvider}
      title={uiT("Fill")}
      styleProps={["background"]}
      headerMenuOnRightClickOnly
      controls={
        <>
          <StyleOverrideControl expsProvider={expsProvider} label={uiT("Fill")}
            styleProps={["background"]} noneValues={{ background: "none" }} noneLabel={uiT("No fill")}
            onChange={() => setInspected(undefined)} />
          <IconButton size="small" tooltip={uiT("Add fill")} onClick={addFill} disabled={isDisabled}>
            <Icon icon={PlusIcon} />
          </IconButton>
        </>
      }
    >
      {isSet && (
        <div>
          <>
            <StyleWrapper
              styleName={["background"]}
              displayStyleName="background"
              showDefinedIndicator={false}
              className="flex-fill"
            >
              <widgets.ListBox
                {...(isDisabled
                  ? {}
                  : {
                      onReorder: (from, to) => moveLayer(from, to),
                    })}
              >
                {bg.layers.map(
                  (layer: BackgroundLayer, index: /*TWZ*/ number) => {
                    const label = switchType(layer.image)
                      .when(LinearGradient, () => uiT("Linear gradient"))
                      .when(RadialGradient, () => uiT("Radial gradient"))
                      .when(ColorFill, ({ color }) => Chroma.valid(color) ? Chroma(color).hex("rgb") : labels[index])
                      .when([ImageBackground, NoneBackground], () => labels[index])
                      .result();
                    return (
                      <widgets.ListBoxItem
                        index={index}
                        key={index}
                        className={styles.fillItem}
                        isDragDisabled={isDisabled || bg.layers.length < 2}
                        disabled={isDisabled}
                        removeLabel={uiT("Remove fill")}
                        onRemove={() => removeLayer(index)}
                        clickable={false}
                        truncate={false}
                        mainContent={
                          <FillRow
                            label={label}
                            thumbnail={thumbnails[index]}
                            image={layer.image}
                            solidColor={solidColors[index]}
                            isDisabled={isDisabled}
                            open={inspected === index}
                            onOpenChange={(open) => setInspected((current) =>
                              open ? index : current === index ? undefined : current
                            )}
                            editor={inspected === index && (
                              <BackgroundLayerPanel
                                layer={layer}
                                expsProvider={expsProvider}
                                onUpdated={(updated) => {
                                  updateLayers((layers) => layers.map((current, i) => i === index ? updated : current));
                                }}
                                vsh={vsh}
                                animatableOnly={animatableOnly}
                              />
                            )}
                            onAlphaChange={(alpha) => changeLayerAlpha(index, alpha)}
                          />
                        }
                      />
                    );
                  },
                )}
              </widgets.ListBox>
            </StyleWrapper>
          </>
        </div>
      )}
    </StylePanelSection>
  );
};

function FillRow({
  label,
  thumbnail,
  image,
  solidColor,
  isDisabled,
  open,
  onOpenChange,
  editor,
  onAlphaChange,
}: {
  label: string;
  thumbnail: string;
  image: BackgroundLayer["image"];
  solidColor: string | undefined;
  isDisabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: React.ReactNode;
  onAlphaChange: (alpha: number) => void;
}) {
  const { t } = useI18n();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const sidebarDepth = useMaybeSidebarModalContext()?.state.stack.length ?? 0;
  const initialSidebarDepth = React.useRef(sidebarDepth);
  useStudioEscape(popupRef, open && !isDisabled, () => {
    onOpenChange(false);
    triggerRef.current?.focus();
  });
  const isSolid = image instanceof ColorFill;
  const title = t(isSolid ? "Fill color" : "Edit fill");
  const token = isSolid && isTokenRef(image.color);
  const alpha = solidColor && Chroma.valid(solidColor)
    ? Math.round(Chroma(solidColor).alpha() * 100)
    : null;
  return (
    <div className={styles.fillValue}>
      <Popover
        trigger="click"
        placement="leftTop"
        title={title}
        open={open && !isDisabled}
        destroyOnHidden
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            initialSidebarDepth.current = sidebarDepth;
          }
          // Keep the fill editor mounted while its image asset editor is open.
          if (sidebarDepth <= initialSidebarDepth.current) {
            onOpenChange(nextOpen);
          }
        }}
        content={
          <div ref={popupRef} className={styles.fillPopover} role="dialog" aria-label={title}>
            <Scrollbar scrollX={false} className={styles.fillPopoverBody}>
              {editor}
            </Scrollbar>
          </div>
        }
      >
        <button
          ref={triggerRef}
          type="button"
          className={styles.fillEdit}
          disabled={isDisabled}
          aria-label={`${t("Edit fill")}: ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open && !isDisabled}
        >
          <span className={styles.fillSwatch} aria-hidden="true">
            <span className="img-thumb" style={{ backgroundImage: thumbnail }} />
          </span>
          <span className={styles.fillLabel}>{label}</span>
        </button>
      </Popover>
      {isSolid && (
        <Tooltip title={token ? t("Opacity is controlled by the color token") : t("Opacity")}>
          <InputNumber
            aria-label={t("Opacity")}
            className={styles.fillOpacity}
            disabled={isDisabled || token || alpha === null}
            value={alpha}
            placeholder="–"
            min={0}
            max={100}
            controls={false}
            suffix="%"
            onChange={(value) => {
              if (value !== null) onAlphaChange(Math.min(100, Math.max(0, value)) / 100);
            }}
          />
        </Tooltip>
      )}
    </div>
  );
}

interface BackgroundLayerPanelProps {
  layer: BackgroundLayer;
  expsProvider: ExpsProvider;
  onUpdated: (layer: BackgroundLayer) => void;
  vsh: VariantedStylesHelper;
  animatableOnly?: boolean;
}

const BackgroundLayerPanel = function BackgroundLayerPanel({
  expsProvider,
  layer,
  onUpdated,
  vsh,
  animatableOnly,
}: BackgroundLayerPanelProps) {
  const { t: uiT } = useI18n();
  const { studioCtx } = expsProvider;
  const imageAssets = useImageAssetList(studioCtx);
  const cachedValuesByBgType = React.useRef<Record<string, string>>({});

  /**
   * General-purpose dumping ground for cached values.  E.g. when user sets a
   * custom size, switches away, then switches back - we want to restore the
   * custom size they had set.
   */
  const cachedValues = React.useRef<Record<string, string>>({});

  const updateImg = <T extends ImageBackground | ColorFill | LinearGradient | RadialGradient>(
    img: T,
    f: (draft: T) => void,
  ) => {
    const draft = cloneDeep(img);
    f(draft);
    onUpdated(new BackgroundLayer({ ...layer, image: draft }));
  };

  const modelType = switchType(layer.image)
    .when(ImageBackground, () => "image")
    .when(ColorFill, () => "fill")
    .when(LinearGradient, () => "linear")
    .when(RadialGradient, () => "radial")
    .when(NoneBackground, () => "none")
    .result();

  const imageCss = layer.image.showCss();
  React.useLayoutEffect(() => {
    cachedValuesByBgType.current[modelType] = imageCss;
    if (layer.size !== undefined && !["cover", "contain"].includes(layer.size)) {
      cachedValues.current["background-size"] = layer.size;
    }
  }, [modelType, imageCss, layer.size]);

  const imageBackgroundPanel = (img: /*TWZ*/ ImageBackground) => {
    // Can only use picture type for background-image
    const id = extractAllAssetRefs(img.url)[0];
    const asset = imageAssets.rows.find((candidate) => candidate.uuid === id && candidate.type === ImageAssetType.Picture);

    return (
      <SidebarSection title={uiT("Image")}>
        <ImageAssetPreviewAndPicker
          className="flex-fill flex-col"
          value={asset ? imageAssets.resolve(asset.ref) : img.url}
          onPicked={(picked) => {
            const newUrl = isKnownImageAsset(picked)
              ? mkImageAssetRef(picked)
              : picked;
            updateImg(new ImageBackground({ url: newUrl }), () => {});
          }}
          type={ImageAssetType.Picture}
          studioCtx={studioCtx}
        />
      </SidebarSection>
    );
  };

  const colorFillPanel = (col: ColorFill) => {
    return (
      <div className={styles.fillColorPicker}>
        <ColorPicker
          compact
          autoFocus
          color={col.color}
          onChange={(color) => {
            if (layer.image instanceof ColorFill) {
              updateImg(col, (col) => {
                return (col.color = color);
              });
            }
          }}
          vsh={vsh}
        />
      </div>
    );
  };

  // TODO does repeating actually have any effect if the color stops are always in %?
  const linearGradientPanel = (lin: LinearGradient) => {
    return (
      <SidebarSection title={uiT("Linear")} key="Linear">
        <LabeledItemRow label={uiT("Angle")}>
          <DimTokenSpinner
            value={`${lin.angle}deg`}
            onChange={(val) => {
              updateImg(lin, (lin) => {
                const { num, units } = ensure(
                  css.parseCssNumericNew(val || "0"),
                  "Must be a valid numeric value",
                );
                lin.angle = num;
              });
            }}
            allowedUnits={["deg"]}
            allowFunctions={false}
          />
          <div
            className={"ml-sm mr-sm overflow-hidden"}
            style={{ marginTop: -10, marginBottom: 0 }}
          >
            <AngleDial
              angle={lin.angle}
              onChange={(val: number) => {
                return updateImg(lin, (lin) => {
                  return (lin.angle = val);
                });
              }}
            />
          </div>
        </LabeledItemRow>

        <ColorStops
          repeating={lin.repeating}
          stops={lin.stops}
          studioCtx={studioCtx}
          onChange={(stops: Stop[]) => {
            return updateImg(lin, (lin) => {
              return (lin.stops = stops);
            });
          }}
          vsh={vsh}
        />
      </SidebarSection>
    );
  };

  const radialGradientPanel = (rad: RadialGradient) => {
    
    return (
      <SidebarSection title={uiT("Radial")} key="Radial">
        <FullRow>
          <div className={"vcenter flex-even"}>
            <UnloggedDragCatcher sc={studioCtx}>
              <EllipseControl
                ellipse={{
                  cx: rad.cx.getNumericValue(),
                  cy: rad.cy.getNumericValue(),
                  rx: rad.rx.getNumericValue(),
                  ry: rad.ry.getNumericValue(),
                }}
                onChange={({ cx, cy, rx, ry }) => {
                  return updateImg(rad, (rad) => {
                    rad.cx.value = `${cx}`;
                    rad.cy.value = `${cy}`;
                    rad.rx.value = `${rx}`;
                    return (rad.ry.value = `${ry}`);
                  });
                }}
              />
            </UnloggedDragCatcher>
          </div>

          <div className={"vcenter flex-even"}>
            <LabeledItemRow label={uiT("Left")} labelSize="small">
              {CustomDimSpinner({
                value: rad.cx.showCss(),
                onChange: (val) =>
                  updateImg(rad, (rad) => rad.cx.setValue(val || "center")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Top")} labelSize="small">
              {CustomDimSpinner({
                value: rad.cy.showCss(),
                onChange: (val) =>
                  updateImg(rad, (rad) => rad.cy.setValue(val || "center")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Width")} labelSize="small">
              {CustomDimSpinner({
                value: rad.rx.showCss(),
                onChange: (val) =>
                  updateImg(rad, (rad) => rad.rx.setValue(val || "")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Height")} labelSize="small">
              {CustomDimSpinner({
                value: rad.ry.showCss(),
                onChange: (val) =>
                  updateImg(rad, (rad) => rad.ry.setValue(val || "")),
              })}
            </LabeledItemRow>
          </div>
        </FullRow>
        <ColorStops
          repeating={rad.repeating}
          stops={rad.stops}
          studioCtx={studioCtx}
          onChange={(stops) => {
            return updateImg(rad, (rad) => (rad.stops = stops));
          }}
          vsh={vsh}
        />
      </SidebarSection>
    );
  };

  const tabContent = switchType(layer.image)
    .when(ImageBackground, (model: /*TWZ*/ ImageBackground) =>
      imageBackgroundPanel(model),
    )
    .when(ColorFill, (model: /*TWZ*/ ColorFill) => colorFillPanel(model))
    .when(LinearGradient, (model: /*TWZ*/ LinearGradient) =>
      linearGradientPanel(model),
    )
    .when(RadialGradient, (model: /*TWZ*/ RadialGradient) =>
      radialGradientPanel(model),
    )
    .when(NoneBackground, (model) => unexpected())
    .result();

  const change = (f: (draft: BackgroundLayer) => void) => {
    const draft = cloneDeep(layer);
    f(draft);
    onUpdated(draft);
  };

  const sizeSection = () => {
    const bgSize = () =>
      ensure(
        css.parseSize(
          layer.size ?? css.getCssInitial("background-size", "div"),
        ),
        "Background size must be a valid numeric value",
      );
    const isCustomSize = !["cover", "contain"].includes(layer.size as string);
    return (
      <TabbedStylePanelSection
        key={String(isCustomSize)}
        expsProvider={expsProvider}
        title={uiT("Size")}
        styleProps={[]}
        emptyBody={!isCustomSize}
        onSwitch={(val) =>
          change((layer) => {
            layer.size = (() => {
              switch (val) {
                case "contain":
                case "cover":
                  return val;
                case "custom":
                  return (
                    cachedValues.current["background-size"] ??
                    css.getCssInitial("background-size", "div")
                  );
                default:
                  return unexpected();
              }
            })();
          })
        }
        activeKey={(() => {
          const sizeVal = layer.size;
          switch (sizeVal) {
            case "contain":
            case "cover":
              return sizeVal;
            default:
              return "custom";
          }
        })()}
        tabs={[
          {
            key: "custom",
            label: uiT("Custom"),
            icon: null,
          },
          {
            key: "cover",
            label: uiT("Cover"),
            icon: (
              <Tooltip title={uiT("Cover")}>
                <Icon icon={CoverIcon} />
              </Tooltip>
            ),
            iconOnly: true,
          },
          {
            key: "contain",
            label: uiT("Contain"),
            icon: <Icon icon={ContainIcon} />,
            iconOnly: true,
          },
        ]}
      >
        {isCustomSize && (
          <div className="panel-block">
            <FullRow twinCols>
              <LabeledItem label={uiT("Width")} labelSize="small">
                <DimTokenSpinner
                  value={maybe(bgSize(), (x: string[]) => x[0]) || ""}
                  onChange={(val) =>
                    change((layer) => {
                      layer.size = css.showWidthHeight(
                        val ?? "auto",
                        bgSize()[1],
                      );
                    })
                  }
                  extraOptions={["auto"]}
                  minDropdownWidth={200}
                  hideArrow
                  allowedUnits={LENGTH_PERCENTAGE_UNITS}
                  allowFunctions
                />
              </LabeledItem>
              <LabeledItem label={uiT("Height")} labelSize="small">
                <DimTokenSpinner
                  value={maybe(bgSize(), (x: string[]) => x[1]) || ""}
                  onChange={(val) =>
                    change((layer) => {
                      layer.size = css.showWidthHeight(
                        bgSize()[0],
                        val ?? "auto",
                      );
                    })
                  }
                  extraOptions={["auto"]}
                  minDropdownWidth={200}
                  hideArrow
                  allowedUnits={LENGTH_PERCENTAGE_UNITS}
                  allowFunctions
                />
              </LabeledItem>
            </FullRow>
          </div>
        )}
      </TabbedStylePanelSection>
    );
  };

  const positionSection = () => {
    const bgPos = css.parseBgPos(
      layer.position ?? css.getCssInitial("background-position", "div"),
    );
    return (
      <SidebarSection title={uiT("Position")}>
        <div className={"panel-block"}>
          <FullRow>
            <PosControls2
              expsProvider={expsProvider}
              posProp={"background"}
              exp={{
                get: (side: string) => bgPos[side] || "auto",
                has: (side: string) => Boolean(layer.position && bgPos[side]),
                set: (side: string, value: string) => {
                  // PosControls2 is a component being used in both positioning and background-positioning
                  // For normal positioning is considering valid to have both sides set to something different than
                  // auto, which makes a change for the height/width to be auto, which is invalid in the context
                  // of background-positioning. So we simply ignore those updates.
                  if (!isStandardSide(side)) {
                    return;
                  }
                  change((layer) => {
                    const nextPosition = { ...bgPos, [side]: value };
                    delete nextPosition[oppSides[side]];
                    layer.position = css.showBgPos(nextPosition);
                  });
                },
              }}
            />
          </FullRow>
        </div>
      </SidebarSection>
    );
  };

  const repeatSection = () => {
    const bgRep = layer.repeat;
    return (
      <SidebarSection
        title={uiT("Repeat")}
        controls={
          <StyleToggleButtonGroup
            value={bgRep}
            onChange={(val) =>
              change((layer) => {
                layer.repeat = val;
              })
            }
          >
            <StyleToggleButton value="repeat">
              <Icon icon={RepeatGridIcon} />
            </StyleToggleButton>
            <StyleToggleButton value="repeat-x">
              <Icon icon={RepeatHIcon} />
            </StyleToggleButton>
            <StyleToggleButton value="repeat-y">
              <Icon icon={RepeatHIcon} className="rotated-90" />
            </StyleToggleButton>
            <StyleToggleButton value="no-repeat">
              <Icon icon={CloseIcon} />
            </StyleToggleButton>
          </StyleToggleButtonGroup>
        }
      />
    );
  };

  const miscSection = () => {
    return (
      <SidebarSection>
        <LabeledItemRow label={uiT("Clipping")}>
          <StyleSelect
            value={
              (layer.clip === bgClipTextTag ? "text" : layer.clip) ||
              css.getCssInitial("background-clip", "div")
            }
            onChange={(val) => change((layer) => (layer.clip = val ?? undefined))}
            valueSetState={layer.clip ? "isSet" : "isUnset"}
          >
            <StyleSelect.Option value="border-box">
              <UiText message={"Within border (default)"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="padding-box">
              <UiText message={"Within padding"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="content-box">
              <UiText message={"Within content"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="text">
              <UiText message={"Clip to text"} />
            </StyleSelect.Option>
          </StyleSelect>
        </LabeledItemRow>

        <LabeledItemRow label={uiT("Scrolling")}>
          <StyleSelect
            value={
              layer.attachment ||
              css.getCssInitial("background-attachment", "div")
            }
            onChange={(val) =>
              change((layer) => (layer.attachment = val ?? undefined))
            }
            valueSetState={layer.attachment ? "isSet" : "isUnset"}
          >
            <StyleSelect.Option value="scroll">
              <UiText message={"Scroll with page (default)"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="fixed">
              <UiText message={"Fixed to page"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="local">
              <UiText message={"Scroll with content"} />
            </StyleSelect.Option>
          </StyleSelect>
        </LabeledItemRow>

        <LabeledItemRow label={uiT("Origin")}>
          <StyleSelect
            value={
              layer.origin || css.getCssInitial("background-origin", "div")
            }
            onChange={(val) => change((layer) => (layer.origin = val ?? undefined))}
            valueSetState={layer.origin ? "isSet" : "isUnset"}
          >
            <StyleSelect.Option value="padding-box">
              <UiText message={"Within padding (default)"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="border-box">
              <UiText message={"Within border"} />
            </StyleSelect.Option>
            <StyleSelect.Option value="content-box">
              <UiText message={"Within content"} />
            </StyleSelect.Option>
          </StyleSelect>
        </LabeledItemRow>
      </SidebarSection>
    );
  };

  return (
    <div>
      {!animatableOnly && (
        <FullRow className="panel-content">
          <StyleToggleButtonGroup
            value={modelType}
            onChange={(bgType) => {
              const image = ensure(
                  parseCss(
                    cachedValuesByBgType.current[
                      ensure(bgType, "Must not be undefined")
                    ] ??
                      defaultValuesByBgType[
                        ensure(bgType, "Must not be undefined")
                      ],
                    { startRule: "backgroundImage" },
                  ),
                  "backgroundImage shouldn't be null",
              );
              onUpdated(new BackgroundLayer({
                ...layer,
                image,
                ...(bgType === "image" && { size: layer.size ?? "cover", position: layer.position ?? "50% 50%" }),
              }));
            }}
          >
            <StyleToggleButton className="flex-fill" value="fill" tooltip={uiT("Solid")}>
              <Icon icon={PaintBucketFillIcon} />
            </StyleToggleButton>
            <StyleToggleButton className="flex-fill" value="image" tooltip={uiT("Image")}>
              <Icon icon={ImageBlockIcon} />
            </StyleToggleButton>
            <StyleToggleButton className="flex-fill" value="linear" tooltip={uiT("Linear gradient")}>
              <Icon icon={LinearIcon} />
            </StyleToggleButton>
            <StyleToggleButton className="flex-fill" value="radial" tooltip={uiT("Radial gradient")}>
              <Icon icon={RadialIcon} />
            </StyleToggleButton>
          </StyleToggleButtonGroup>
        </FullRow>
      )}
      {tabContent}
      {modelType === "image" && sizeSection()}
      {modelType !== "fill" && (
        <details className={styles.fillAdvanced}>
          <summary>{uiT("More settings")}</summary>
          {modelType !== "image" && sizeSection()}
          {positionSection()}
          {repeatSection()}
          {miscSection()}
        </details>
      )}
    </div>
  );
};

const defaultValuesByBgType = {
  image: `url("${userImgUrl()}")`,
  linear: "linear-gradient(0deg, #CE9FFF 0%, #56B9FF 100%)",
  radial:
    "radial-gradient(ellipse 40% 60% at 20% 20%, #CE9FFF 0%, #56B9FF 100%)",
  fill: `linear-gradient(#ffffff, #ffffff)`,
};

function CustomDimSpinner({
      value,
      onChange,
    }: {
      onChange: (val?: string) => any;
      value: string;
    }) {
      return (
        <DimTokenSpinner
          value={value}
          onChange={onChange}
          allowedUnits={PERCENTAGE_UNITS}
          noClear={true}
          allowFunctions={false}
        />
      );
    }

