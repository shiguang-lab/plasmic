import { EllipseControl } from "@/wab/client/components/EllipseControl";
import { useBackgroundInputs } from "@/wab/client/studio-ctx/background-inputs";
import { useImageAssetList } from "@/wab/client/studio-ctx/image-asset-inputs";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useMaybeSidebarModalContext } from "@/wab/client/components/sidebar/SidebarModal";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import styles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import {
  LabeledItemRow,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import { AngleDial } from "@/wab/client/components/style-controls/AngleDial";
import { ColorStops } from "@/wab/client/components/style-controls/ColorStops";
import { ImageAssetPreviewAndPicker } from "@/wab/client/components/style-controls/ImageSelector";
import {
  ExpsProvider,
  StylePanelSection,
  changeStyle,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells, useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
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
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
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
  switchType,
} from "@/wab/shared/common";
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
import { isKnownImageAsset } from "@/wab/shared/model/classes";
import { userImgUrl } from "@/wab/shared/urls";
import Chroma from "@/wab/shared/utils/color-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { cloneDeep } from "lodash";
import { Popover, Segmented, Select, Tooltip } from "antd";
import React, { useState } from "react";
import { FiSlash } from "react-icons/fi";

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
  if (backgroundCell?.raw !== "none") {
    bg.filterNoneLayers();
  }

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
      } else {
        expsProvider.maybeTargetExp()?.clear("background");
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

  const addFill = () => {
    setInspected(0);
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
          <IconButton size="small" tooltip={uiT("Add fill")} onClick={addFill} disabled={isDisabled}>
            <Icon icon={PlusIcon} />
          </IconButton>
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
                      .when(ImageBackground, () => labels[index])
                      .when(NoneBackground, () => uiT("None"))
                      .result();
                    return (
                      <widgets.ListBoxItem
                        index={index}
                        key={index}
                        className={styles.fillItem}
                        isDragDisabled={isDisabled || bg.layers.length < 2}
                        disabled={isDisabled}
                        removeLabel={uiT(layer.image instanceof NoneBackground ? "Remove None override" : "Remove fill")}
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
                                  if (updated.image instanceof NoneBackground) {
                                    updateLayers(() => [mkBackgroundLayer(new NoneBackground())]);
                                    setInspected(0);
                                  } else {
                                    updateLayers((layers) => layer.image instanceof NoneBackground
                                      ? [updated]
                                      : layers.map((current, i) => i === index ? updated : current));
                                  }
                                }}
                                vsh={vsh}
                                animatableOnly={animatableOnly}
                              />
                            )}
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
}: {
  label: string;
  thumbnail: string;
  image: BackgroundLayer["image"];
  solidColor: string | undefined;
  isDisabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: React.ReactNode;
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
  const alpha = solidColor && Chroma.valid(solidColor)
    ? Math.round(Chroma(solidColor).alpha() * 100)
    : null;
  return (
    <div className={styles.fillValue}>
      <Popover
        trigger="click"
        placement="left"
        arrow={false}
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
            {editor}
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
          {image instanceof NoneBackground ? <FiSlash aria-hidden="true" /> : <span className={styles.fillSwatch} aria-hidden="true">
            <span className="img-thumb" style={{ backgroundImage: thumbnail }} />
          </span>}
          <span className={styles.fillLabel}>{label}</span>
          {isSolid && <span className={styles.valueSummary}>{alpha === null ? "–" : `${alpha} %`}</span>}
        </button>
      </Popover>
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
      <SidebarSection noBorder zeroBodyPadding noBottomPadding>
        <ImageAssetPreviewAndPicker
          className="flex-fill flex-col"
          value={asset ? imageAssets.resolve(asset.ref) : img.url}
          onPicked={(picked) => {
            const newUrl = isKnownImageAsset(picked)
              ? mkImageAssetRef(picked)
              : picked;
            updateImg(new ImageBackground({ url: newUrl }), () => { /* The replacement image is already configured; no extra mutation is needed. */ });
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
              updateImg(col, (next) => {
                return (next.color = color);
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
      <SidebarSection noBorder zeroBodyPadding noBottomPadding key="Linear">
        <LabeledItemRow label={uiT("Angle")} alignment="center">
          <DimTokenSpinner
            value={`${lin.angle}deg`}
            onChange={(val) => {
              updateImg(lin, (next) => {
                const { num } = ensure(
                  css.parseCssNumericNew(val || "0"),
                  "Must be a valid numeric value",
                );
                next.angle = num;
              });
            }}
            allowedUnits={["deg"]}
            allowFunctions={false}
          />
          <div className={styles.fillAngle}>
            <AngleDial
              angle={lin.angle}
              onChange={(val: number) => {
                return updateImg(lin, (next) => {
                  return (next.angle = val);
                });
              }}
            />
          </div>
        </LabeledItemRow>

        <ColorStops
          compact
          repeating={lin.repeating}
          stops={lin.stops}
          studioCtx={studioCtx}
          onChange={(stops: Stop[]) => {
            return updateImg(lin, (next) => {
              return (next.stops = stops);
            });
          }}
          vsh={vsh}
        />
      </SidebarSection>
    );
  };

  const radialGradientPanel = (rad: RadialGradient) => {
    
    return (
      <SidebarSection noBorder zeroBodyPadding noBottomPadding key="Radial">
        <div className={styles.fillRadial}>
          <div>
            <UnloggedDragCatcher sc={studioCtx}>
              <EllipseControl
                ellipse={{
                  cx: rad.cx.getNumericValue(),
                  cy: rad.cy.getNumericValue(),
                  rx: rad.rx.getNumericValue(),
                  ry: rad.ry.getNumericValue(),
                }}
                onChange={({ cx, cy, rx, ry }) => {
                  return updateImg(rad, (next) => {
                    next.cx.value = `${cx}`;
                    next.cy.value = `${cy}`;
                    next.rx.value = `${rx}`;
                    return (next.ry.value = `${ry}`);
                  });
                }}
              />
            </UnloggedDragCatcher>
          </div>

          <div className={styles.fillRadialFields}>
            <LabeledItemRow label={uiT("Left")} labelSize="small">
              {CustomDimSpinner({
                value: rad.cx.showCss(),
                onChange: (val) =>
                  updateImg(rad, (next) => next.cx.setValue(val || "center")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Top")} labelSize="small">
              {CustomDimSpinner({
                value: rad.cy.showCss(),
                onChange: (val) =>
                  updateImg(rad, (next) => next.cy.setValue(val || "center")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Width")} labelSize="small">
              {CustomDimSpinner({
                value: rad.rx.showCss(),
                onChange: (val) =>
                  updateImg(rad, (next) => next.rx.setValue(val || "")),
              })}
            </LabeledItemRow>
            <LabeledItemRow label={uiT("Height")} labelSize="small">
              {CustomDimSpinner({
                value: rad.ry.showCss(),
                onChange: (val) =>
                  updateImg(rad, (next) => next.ry.setValue(val || "")),
              })}
            </LabeledItemRow>
          </div>
        </div>
        <ColorStops
          compact
          repeating={rad.repeating}
          stops={rad.stops}
          studioCtx={studioCtx}
          onChange={(stops) => {
            return updateImg(rad, (next) => (next.stops = stops));
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
    .when(NoneBackground, () => null)
    .result();

  const change = (f: (draft: BackgroundLayer) => void) => {
    const draft = cloneDeep(layer);
    f(draft);
    onUpdated(draft);
  };

  const sizeSection = () => {
    const isCustomSize = !["cover", "contain"].includes(layer.size ?? "");
    const size = isCustomSize
      ? css.splitCssValueIntoParts(layer.size ?? "auto auto")
      : undefined;
    return (
      <div className={styles.fillSettingsGroup}>
        <div className={styles.fillSettingsLabel}>{uiT("Size")}</div>
        <Segmented
          block
          aria-label={uiT("Size")}
          value={isCustomSize ? "custom" : layer.size}
          options={[
            { value: "custom", label: uiT("Custom") },
            { value: "cover", label: uiT("Cover") },
            { value: "contain", label: uiT("Contain") },
          ]}
          onChange={(value) => change((draft) => {
            draft.size = value === "custom"
              ? cachedValues.current["background-size"] ?? "auto"
              : value;
          })}
        />
        {size && (
          <div className={styles.fillSettingsColumns}>
            {(["Width", "Height"] as const).map((label, index) => (
              <div key={label} className={styles.fillSettingsField}>
                <span>{uiT(label)}</span>
                <DimTokenSpinner
                  fieldAriaProps={{ "aria-label": uiT(label) }}
                  value={size[index] ?? "auto"}
                  onChange={(value) => change((draft) => {
                    draft.size = css.showWidthHeight(
                      index === 0 ? value ?? "auto" : size[0] ?? "auto",
                      index === 1 ? value ?? "auto" : size[1] ?? "auto",
                    );
                  })}
                  extraOptions={["auto"]}
                  hideArrow
                  allowedUnits={LENGTH_PERCENTAGE_UNITS}
                  allowFunctions
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const positionSection = () => {
    const position: Partial<Record<"left" | "right" | "top" | "bottom", string>> =
      css.parseBgPos(layer.position ?? css.getCssInitial("background-position", "div"));
    return (
      <div className={styles.fillSettingsGroup}>
        <div className={styles.fillSettingsLabel}>{uiT("Position")}</div>
        {([
          ["Horizontal", "left", "right", "Left", "Right"],
          ["Vertical", "top", "bottom", "Top", "Bottom"],
        ] as const).map(([label, start, end, startLabel, endLabel]) => {
          const side = position[end] !== undefined ? end : start;
          return (
            <div key={label} className={styles.fillPositionRow}>
              <span className={styles.fillSettingsLabel}>{uiT(label)}</span>
              <Select
                aria-label={`${uiT(label)} ${uiT("Position")}`}
                value={side}
                options={[
                  { value: start, label: uiT(startLabel) },
                  { value: end, label: uiT(endLabel) },
                ]}
                onChange={(nextSide) => change((draft) => {
                  const next = { ...position };
                  delete next[start];
                  delete next[end];
                  next[nextSide] = position[side] ?? "0%";
                  draft.position = css.showBgPos(next);
                })}
              />
              <DimTokenSpinner
                fieldAriaProps={{ "aria-label": uiT(label) }}
                value={position[side] ?? "0%"}
                onChange={(value) => change((draft) => {
                  draft.position = css.showBgPos({ ...position, [side]: value ?? "0%" });
                })}
                hideArrow
                allowedUnits={LENGTH_PERCENTAGE_UNITS}
                allowFunctions
              />
            </div>
          );
        })}
      </div>
    );
  };

  const repeatSection = () => (
    <div className={styles.fillSettingsRow}>
      <span className={styles.fillSettingsLabel}>{uiT("Repeat")}</span>
      <Segmented
        block
        aria-label={uiT("Repeat")}
        value={layer.repeat ?? css.getCssInitial("background-repeat", "div")}
        options={[
          { value: "repeat", label: <Tooltip title={uiT("Repeat")}><span aria-label={uiT("Repeat")}><Icon icon={RepeatGridIcon} /></span></Tooltip> },
          { value: "repeat-x", label: <Tooltip title={uiT("Horizontal")}><span aria-label={uiT("Horizontal")}><Icon icon={RepeatHIcon} /></span></Tooltip> },
          { value: "repeat-y", label: <Tooltip title={uiT("Vertical")}><span aria-label={uiT("Vertical")}><Icon icon={RepeatHIcon} className="rotated-90" /></span></Tooltip> },
          { value: "no-repeat", label: <Tooltip title={uiT("None")}><span aria-label={uiT("None")}><Icon icon={CloseIcon} /></span></Tooltip> },
        ]}
        onChange={(value) => change((draft) => { draft.repeat = value; })}
      />
    </div>
  );

  const miscSection = () => (
    <div className={styles.fillSettingsGroup}>
      <div className={styles.fillSettingsRow}>
        <span className={styles.fillSettingsLabel}>{uiT("Clipping")}</span>
        <Select
          aria-label={uiT("Clipping")}
          value={(layer.clip === bgClipTextTag ? "text" : layer.clip) || css.getCssInitial("background-clip", "div")}
          onChange={(value) => change((draft) => { draft.clip = value; })}
          options={[
            { value: "border-box", label: uiT("Within border") },
            { value: "padding-box", label: uiT("Within padding") },
            { value: "content-box", label: uiT("Within content") },
            { value: "text", label: uiT("Clip to text") },
          ]}
        />
      </div>
      <div className={styles.fillSettingsRow}>
        <span className={styles.fillSettingsLabel}>{uiT("Scrolling")}</span>
        <Select
          aria-label={uiT("Scrolling")}
          value={layer.attachment || css.getCssInitial("background-attachment", "div")}
          onChange={(value) => change((draft) => { draft.attachment = value; })}
          options={[
            { value: "scroll", label: uiT("Scroll with page") },
            { value: "fixed", label: uiT("Fixed to page") },
            { value: "local", label: uiT("Scroll with content") },
          ]}
        />
      </div>
      <div className={styles.fillSettingsRow}>
        <span className={styles.fillSettingsLabel}>{uiT("Origin")}</span>
        <Select
          aria-label={uiT("Origin")}
          value={layer.origin || css.getCssInitial("background-origin", "div")}
          onChange={(value) => change((draft) => { draft.origin = value; })}
          options={[
            { value: "padding-box", label: uiT("Within padding") },
            { value: "border-box", label: uiT("Within border") },
            { value: "content-box", label: uiT("Within content") },
          ]}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.fillPanel}>
      {!animatableOnly && (
        <div className={styles.fillTypes}>
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
            <StyleToggleButton className="flex-fill" value="none" tooltip={uiT("None")}>
              <Icon icon={FiSlash} />
            </StyleToggleButton>
          </StyleToggleButtonGroup>
        </div>
      )}
      {modelType !== "none" && <Scrollbar defer={false} scrollX={false} className={styles.fillPopoverBody}>
        <div className={styles.fillPanelContent}>
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
      </Scrollbar>}
    </div>
  );
};

const defaultValuesByBgType = {
  image: `url("${userImgUrl()}")`,
  linear: "linear-gradient(0deg, #CE9FFF 0%, #56B9FF 100%)",
  radial:
    "radial-gradient(ellipse 40% 60% at 20% 20%, #CE9FFF 0%, #56B9FF 100%)",
  fill: `linear-gradient(#ffffff, #ffffff)`,
  none: "none",
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

