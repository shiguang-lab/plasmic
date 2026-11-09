import { ColorTokenPopup } from "@/wab/client/components/sidebar/ColorTokenPopup";
import { newTokenValueAllowed } from "@/wab/client/components/sidebar/token-utils";
import { ColorSwatch } from "@/wab/client/components/style-controls/ColorSwatch";
import { UnloggedDragCatcher } from "@/wab/client/components/style-controls/UnloggedDragCatcher";
import Button from "@/wab/client/components/widgets/Button";
import "@/wab/client/components/widgets/ColorPicker/Pickr.overrides.scss";
import { useColorTokenChoiceInputs, type ColorTokenChoice } from "@/wab/client/studio-ctx/color-token-choice-inputs";
import { useClientTokenValues } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import { useClientTokenResolver } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import {
  ColorMode,
  getColorAlpha,
  getColorComponents,
  getFullColorRepresentation,
  getShortColorHex,
  getShortenedColor,
  getShortenedHSL,
} from "@/wab/client/components/widgets/ColorPicker/colorPickerUtils";
import { ColorTokenSelector } from "@/wab/client/components/widgets/ColorTokenSelector";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { ensureNumber, nudgeIntoRange } from "@/wab/client/number-utils";
import { CloseIcon } from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import { useUndo } from "@/wab/client/shortcuts/studio/useUndo";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  derefTokenRefs,
  isStyleTokenEditable,
  mkTokenRef,
  tryParseTokenRef,
} from "@/wab/commons/StyleToken";
import { MaybeWrap, useCommittedValue } from "@/wab/commons/components/ReactUtil";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { ensure, spawn } from "@/wab/shared/common";
import {
  TokenValueResolver,
  siteFinalColorTokens,
  siteFinalStyleTokensAllDeps,
} from "@/wab/shared/core/site-style-tokens";
import {
  FinalToken,
  MutableToken,
  OverrideableToken,
} from "@/wab/shared/core/tokens";
import { StyleToken } from "@/wab/shared/model/classes";
import { canCreateAlias } from "@/wab/shared/ui-config-utils";
import { Chroma } from "@/wab/shared/utils/color-utils";
import Pickr from "@simonwep/pickr";
import "@simonwep/pickr/dist/themes/nano.min.css";
import { Input, InputRef, Select, Tooltip } from "antd";
import { sortBy } from "lodash";
import debounce from "lodash/debounce";
import defer from "lodash/defer";
import { useStyleTokenCatalogInputs, useTokenPickerPermissions } from "@/wab/client/studio-ctx/style-token-catalog-inputs";
import * as React from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function tryGetRealColor(
  color: string,
  sc: StudioCtx,
  resolver: TokenValueResolver,
  vsh: VariantedStylesHelper = new VariantedStylesHelper(),
  maybeColorTokens?: FinalToken<StyleToken>[],
) {
  const colorTokens = maybeColorTokens
    ? maybeColorTokens
    : sortBy(
        siteFinalColorTokens(sc.site, { includeDeps: "direct" }),
        (t) => t.name,
      );

  // Currently-applied token, if `color` is a token reference
  const appliedToken = color ? tryParseTokenRef(color, colorTokens) : undefined;

  // The actual hex value
  const realColor = appliedToken ? resolver(appliedToken, vsh) : color;

  return { colorTokens, appliedToken, realColor };
}

/** Imperative conversion and scheduled-write lifetime owned by one picker. */
class ColorPickerSession {
  private readonly conversions = new Map<string, string>();
  private frame: number | undefined;
  readonly propagate: ReturnType<typeof debounce>;
  constructor(readOnChange: () => (value: string) => void) {
    this.propagate = debounce((value: string) => {
      if (this.frame !== undefined) { window.cancelAnimationFrame(this.frame); }
      this.frame = window.requestAnimationFrame(() => {
        this.frame = undefined;
        readOnChange()(/#0{8}/i.test(value) ? "transparent" : value);
      });
    }, 50, { maxWait: 150 });
  }
  restore(value: string) { return this.conversions.get(value) || value; }
  remember(hsl: string, hex: string) { if (!this.conversions.has(hsl)) { this.conversions.set(hsl, hex); } }
  dispose = () => {
    this.propagate.cancel();
    if (this.frame !== undefined) { window.cancelAnimationFrame(this.frame); this.frame = undefined; }
  };
}

interface ColorPickerProps {
  color: string;
  onChange: (colorOrToken: string) => void;
  autoFocus?: boolean;
  hideTokenPicker?: boolean;
  derefToken?: boolean;
  colorTokens?: FinalToken<StyleToken>[];
  vsh?: VariantedStylesHelper;
}

export const ColorPicker = React.memo(function ColorPicker(props: ColorPickerProps) {
  const studio = useStudioCtx();
  const catalog = useStyleTokenCatalogInputs(studio, "Color", props.vsh, props.colorTokens);
  return catalog.source?.isActive() ? <ColorPicker_ key={catalog.source.key} {...props} colorTokens={props.colorTokens ?? sortBy(catalog.tokens, (token) => token.name)} /> : null;
});

function ColorPicker_(props: ColorPickerProps) {
  const sc = useStudioCtx();
  const vsh = React.useMemo(() => props.vsh ?? new VariantedStylesHelper(), [props.vsh]);
  const resolver = useClientTokenResolver();
  const { colorTokens, realColor: resolvedColor, appliedToken } = tryGetRealColor(props.color, sc, resolver, vsh, props.colorTokens);
  const applied = useColorTokenChoiceInputs(sc, appliedToken ? [appliedToken] : [], vsh);
  const palette = useColorTokenChoiceInputs(sc, props.hideTokenPicker ? [] : colorTokens.filter((token) => token !== appliedToken), vsh);
  const paletteColors = useClientTokenValues(palette.snapshot.choices.map((row) => row.resolved), palette.lifetime);
  if (resolvedColor === undefined) { return null; }
  const realColor = props.color === "" ? "#FFFFFF" : ensure(resolvedColor, "Unexpected empty real color");
  return <ColorPickerContent {...props} {...{ realColor, appliedToken, palette, paletteColors, vsh }} appliedChoice={applied.snapshot.choices[0]} />;
}

function ColorPickerContent({
  autoFocus = false, hideTokenPicker, derefToken, color, onChange, vsh,
  realColor, appliedToken, appliedChoice, palette, paletteColors,
}: ColorPickerProps & {
  realColor: string;
  vsh: VariantedStylesHelper;
  appliedToken: FinalToken<StyleToken> | undefined;
  appliedChoice: ColorTokenChoice | undefined;
  palette: ReturnType<typeof useColorTokenChoiceInputs>;
  paletteColors: ReturnType<typeof useClientTokenValues>;
}) {
  const { t: uiT } = useI18n();
  const sc = useStudioCtx();
  const permissions = useTokenPickerPermissions(sc);
  const canCreateToken = permissions.canCreateTokens;
  const [justAddedUid, setJustAddedUid] = React.useState<number>();
  const [editToken, setEditToken] = React.useState<MutableToken<StyleToken> | OverrideableToken<StyleToken>>();
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [pickr, setPickr] = useState<Pickr | null>(null);
  const [mode, setMode] = useState(ColorMode.hex);
  const initialColor = getShortenedColor(realColor, mode);
  const initialAlpha = getColorAlpha(realColor);
  const {
    value: colorInputValue,
    push: setColorInputValue,
    handleKeyDown: handleColorUndoKeyDown,
    reset: resetColorInputValue,
  } = useUndo(initialColor);
  const {
    value: alphaInputValue,
    push: setAlphaInputValue,
    handleKeyDown: handleAlphaUndoKeyDown,
    reset: resetAlphaInputValue,
  } = useUndo(initialAlpha);
  useEffect(() => {
    resetColorInputValue(initialColor);
    resetAlphaInputValue(initialAlpha);
  }, [initialColor, initialAlpha]);
  const colorInputRef = useRef<InputRef>(null);

  const readOnChange = useCommittedValue(onChange);
  const session = useMemo(() => new ColorPickerSession(readOnChange), [readOnChange]);
  const propagateChangesToParent = session.propagate;
  useEffect(() => session.dispose, [session]);

  const controlledHexColor =
    !realColor || Chroma.isLiteralTransparent(realColor)
      ? "#00000000"
      : Chroma.isLiteralUnpickedColor(realColor) || !Chroma.valid(realColor)
        ? "#000000"
        : realColor;

  useLayoutEffect(() => {
    if (appliedToken) {
      return;
    }

    const show = () => {
      if (autoFocus) {
        colorInputRef.current?.focus();
        colorInputRef.current?.select();
      }
    };

    const change = (v: Pickr.HSVaColor, source) => {
      if (source !== "slider") {
        return;
      }

      const newHexaColor = v.toHEXA().toString();
      propagateChangesToParent(newHexaColor);
    };

    const _pickr = Pickr.create({
      el: colorPickerRef.current!,
      container: colorPickerRef.current!,
      showAlways: true,
      inline: true,
      theme: "nano",
      default: controlledHexColor,
      components: {
        preview: true,
        opacity: true,
        hue: true,
        // Studio renders its own custom Hex/RGB/HSL inputs, so disable Pickr's
        // built-in interaction.
        interaction: {},
      },
    })
      .on("show", show)
      .on("change", change);

    setPickr(_pickr);

    return () => {
      _pickr.off("show", show);
      _pickr.off("change", change);
      _pickr.destroy();
    };
  }, [appliedToken]);

  useLayoutEffect(() => {
    if (
      pickr &&
      !appliedToken &&
      pickr.getColor().toHEXA().toString() !== controlledHexColor
    ) {
      pickr.setColor(controlledHexColor);
    }
  }, [pickr, controlledHexColor, appliedToken]);

  const getPickrHSVA = () => Array.from(pickr!.getColor().toHSVA());

  const applyColor = (newColor: string) => {
    if (Chroma.isLiteralUnpickedColor(newColor)) {
      pickr?.setHSVA(0, 0, 0, 1);
      applyAlpha(100);
      return;
    }

    const isChangingToTransparent = Chroma.isLiteralTransparent(newColor);
    if (isChangingToTransparent) {
      newColor = "black";
      applyAlpha(0);
    }

    const fullColorRep = getFullColorRepresentation(newColor, mode);

    if (Chroma.valid(fullColorRep)) {
      pickr?.setColor(fullColorRep);
      const [h, s, v] = getPickrHSVA();
      pickr?.setHSVA(h, s, v, alphaInputValue / 100);
      propagateChangesToParent(pickr?.getColor().toHEXA().toString());
    }
  };

  const applyAlpha = (newAlpha: number) => {
    if (isNaN(newAlpha)) {
      return;
    }

    window.requestAnimationFrame(() => {
      const [h, s, v] = getPickrHSVA();
      pickr?.setHSVA(h, s, v, newAlpha / 100);
      propagateChangesToParent(pickr?.getColor().toHEXA().toString());
    });
  };

  const selectColorComponent = (target: HTMLInputElement) => {
    // To make sure we get the caret on the right position
    // we defer the execution to next tick
    defer(() => {
      const editingComponent = getColorComponents(
        target.value,
        target.selectionStart ?? -1,
      ).find((it) => it.editing);

      if (editingComponent) {
        window.requestAnimationFrame(() => {
          target.setSelectionRange(
            editingComponent?.start,
            editingComponent?.end,
            "backward",
          );
        });
      }
    });
  };

  const handleModeChange = (newMode: ColorMode) => {
    const currentColorRestored = getFullColorRepresentation(
      colorInputValue,
      mode,
    );
    const formattedColorInNewMode = getShortenedColor(
      session.restore(currentColorRestored),
      newMode,
    );

    setMode(newMode);

    if (newMode === ColorMode.hsl) {
      session.remember(
        getFullColorRepresentation(formattedColorInNewMode, newMode),
        getShortColorHex(currentColorRestored),
      );
    }
  };

  const handleColorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleColorUndoKeyDown(e)) {
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        e.stopPropagation();

        applyColor(colorInputValue);

        break;

      case "ArrowUp":
      case "ArrowDown": {
        if (mode === ColorMode.hex) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget!;
        const selectionStart = target.selectionStart ?? -1;

        const colorComponents = getColorComponents(
          target.value,
          selectionStart,
        ).map((it, i) => {
          const step = e.key === "ArrowDown" ? -1 : +1;
          const newValue = it.editing ? it.value + step : it.value;
          const maxValue = mode === ColorMode.hsl ? (i === 0 ? 360 : 100) : 255;

          return {
            ...it,
            value: nudgeIntoRange(newValue, { min: 0, max: maxValue }),
            end: it.start + newValue.toString().length,
          };
        });

        const modifiedColorRaw = getFullColorRepresentation(
          colorComponents.map((it) => it.value).join(","),
          mode,
        );

        const modifiedColorFormatted =
          mode === ColorMode.hsl
            ? getShortenedHSL.call(
                null,
                ...colorComponents.map((it) => it.value),
              )
            : getShortenedColor(modifiedColorRaw, mode);

        const editingComponent = getColorComponents(modifiedColorFormatted)[
          colorComponents.findIndex((it) => it.editing)
        ];

        if (editingComponent) {
          // Normally we would just use applyColor to change the color,
          // but since we are trying to setSelectionRange, we need to make sure
          // colorInputValue is updated on the next render to work.
          const newColorInputValue = getShortenedColor(modifiedColorRaw, mode);
          setColorInputValue(newColorInputValue);

          applyColor(modifiedColorFormatted);
          window.requestAnimationFrame(() => {
            target.setSelectionRange(
              editingComponent?.start,
              editingComponent?.end,
              "backward",
            );
          });
        }
      }
    }
  };

  const handleAlphaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleAlphaUndoKeyDown(e)) {
      return;
    }

    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown": {
        e.preventDefault();
        e.stopPropagation();

        const step = e.key === "ArrowUp" ? +1 : -1;
        const newAlphaValue = nudgeIntoRange(alphaInputValue + step, {
          min: 0,
          max: 100,
        });
        applyAlpha(newAlphaValue);
        break;
      }

      case "Enter": {
        e.preventDefault();
        e.stopPropagation();

        applyAlpha(alphaInputValue);
        break;
      }
    }
  };

  const isEditable =
    appliedToken && isStyleTokenEditable(appliedToken, vsh, permissions);

  const selectPaletteToken = async (row: ColorTokenChoice) => {
    const token = palette.command(row);
    if (!token) { return; }

              if (derefToken) {
                onChange(
                  derefTokenRefs(
                    siteFinalStyleTokensAllDeps(sc.site),
                    vsh.getActiveTokenValue(token),
                    vsh,
                  ),
                );
              } else if (appliedToken && editToken) {
                const value = mkTokenRef(token.base);
                if (newTokenValueAllowed(appliedToken, sc.site, value, vsh)) {
                  await sc.changeUnsafe(() => {
                    const current = palette.command(row);
                    if (current && isStyleTokenEditable(appliedToken, vsh, sc.getCurrentUiConfig()) && siteFinalStyleTokensAllDeps(sc.site).some((candidate) => candidate.base === appliedToken.base)) {
                      vsh.updateToken(appliedToken, mkTokenRef(current.base));
                    }
                  });
                }
              } else {
                onChange(mkTokenRef(token.base));
              }
              };
  // Closures capture this committed render's original callbacks and source.
  // No shared handler ref is changed by speculative renders.
  const paletteRows = palette.snapshot.active ? palette.snapshot.choices.map((row, index) => ({
    id: row.id, name: row.name, color: ensure(paletteColors[index], "Native palette color must exist"),
    selected: row.ref.uid === appliedToken?.base.uid,
    onSelect: () => spawn(selectPaletteToken(row)),
  })) : [];

  return (
    <div>
      {!appliedToken && (
        <>
          <UnloggedDragCatcher sc={sc}>
            <div ref={colorPickerRef} />
          </UnloggedDragCatcher>
          <Input.Group compact>
            <Select
              dropdownStyle={{ zIndex: 10000 }}
              style={{ width: "27%" }}
              value={mode}
              onChange={handleModeChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                }
              }}
            >
              <Select.Option value={ColorMode.hex}>Hex</Select.Option>
              <Select.Option value={ColorMode.rgb}>RGB</Select.Option>
              <Select.Option value={ColorMode.hsl}>HSL</Select.Option>
            </Select>
            <Input
              ref={colorInputRef}
              style={{ width: "48%" }}
              onFocus={(e) =>
                mode === ColorMode.hex
                  ? e.target.select()
                  : selectColorComponent(e.currentTarget)
              }
              onClick={(e) =>
                mode !== ColorMode.hex && selectColorComponent(e.currentTarget)
              }
              data-test-id={`${"Color"}-input`}
              value={colorInputValue}
              onChange={(e) => setColorInputValue(e.target.value)}
              onKeyDown={handleColorKeyDown}
              onBlur={() => applyColor(colorInputValue)}
            />
            <Input
              style={{ width: "25%" }}
              disabled={Chroma.isLiteralUnpickedColor(colorInputValue)}
              onFocus={(e) => e.target.select()}
              value={alphaInputValue}
              suffix="%"
              onChange={(e) =>
                setAlphaInputValue(
                  nudgeIntoRange(ensureNumber(e.target.value), {
                    min: 0,
                    max: 100,
                  }),
                )
              }
              onKeyDown={handleAlphaKeyDown}
              onBlur={() => applyAlpha(alphaInputValue)}
            />
          </Input.Group>
        </>
      )}
      {!hideTokenPicker && (
        <div className={"mt-m"}>
          {appliedToken && (
            <div className="flex flex-vcenter mb-sm">
              <MaybeWrap
                cond={!!isEditable}
                wrapper={(x) => (
                  <Tooltip title={uiT("Edit color token")}>
                    <TriggerTarget>{x as React.ReactElement}</TriggerTarget>
                  </Tooltip>
                )}
              >
                <Button
                  type="chip"
                  onClick={
                    isEditable ? () => setEditToken(appliedToken) : undefined
                  }
                  startIcon={
                    <ColorSwatch
                      color={realColor}
                      tooltip={Chroma.stringify(realColor)}
                    />
                  }
                  endIcon={
                    <IconButton
                      type="seamless"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Ensure we don't reuse the old alpha value when the color picker was mounted
                        resetAlphaInputValue(getColorAlpha(realColor));
                        onChange(realColor);
                      }}
                      tooltip={uiT("Remove token")}
                    >
                      <Icon icon={CloseIcon} />
                    </IconButton>
                  }
                  withIcons={["startIcon", "endIcon"]}
                >
                  <Tooltip title={appliedChoice?.name} mouseEnterDelay={0.5}>
                    <div className="fill-width text-ellipsis">
                      {appliedChoice?.name}
                    </div>
                  </Tooltip>
                </Button>
              </MaybeWrap>
            </div>
          )}
          {palette.snapshot.active && <ColorTokenSelector
            rows={paletteRows}
            hideAddToken={!canCreateToken}
            onAddToken={async () => {
              return sc.changeUnsafe(() => {
                if (!palette.isActive() || !canCreateAlias(sc.getCurrentUiConfig(), "token")) { return; }
                const newToken = sc.tplMgr().addStyleToken({
                  tokenType: "Color",
                  value: realColor,
                });
                setJustAddedUid(newToken.uid);
                onChange(mkTokenRef(newToken));
                setEditToken(new MutableToken(newToken));
              });
            }}
            autoFocusSearch={!!appliedToken}
            maxRows={appliedToken ? 5 : 3}
          />}
        </div>
      )}
      {editToken && (
        <ColorTokenPopup
          token={editToken}
          studioCtx={sc}
          show={true}
          onClose={() => {
            setEditToken(undefined);
            setJustAddedUid(undefined);
          }}
          autoFocusName={justAddedUid === editToken.base.uid}
          vsh={vsh}
        />
      )}
    </div>
  );
}
