import { FieldAriaProps } from "@/wab/client/components/aria-utils";
import ListItem from "@/wab/client/components/ListItem";
import ListSectionHeader from "@/wab/client/components/ListSectionHeader";
import ListSectionSeparator from "@/wab/client/components/ListSectionSeparator";
import { GeneralTokenEditModal } from "@/wab/client/components/sidebar/GeneralTokenEditModal";
import { ValueSetState } from "@/wab/client/components/sidebar/sidebar-helpers";
import { Matcher } from "@/wab/client/components/view-common";
import Chip from "@/wab/client/components/widgets/Chip";
import { useClientTokenValues } from "@/wab/client/components/widgets/ColorPicker/client-token-resolver";
import DropdownOverlay from "@/wab/client/components/widgets/DropdownOverlay";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { VirtualListScrollbar } from "@/wab/client/components/widgets/VirtualListScrollbar";
import { useOnContainerScroll } from "@/wab/client/dom-utils";
import { showError } from "@/wab/client/ErrorNotifications";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import PencilIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Pencil";
import { PlusCircleIcon } from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__PlusCircle";
import PlasmicDimTokenSelector, {
  PlasmicDimTokenSelector__VariantsArgs,
} from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicDimTokenSelector";
import { useUndo } from "@/wab/client/shortcuts/studio/useUndo";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import {
  derefToken,
  isStyleTokenEditable,
  mkTokenRef,
  StyleTokenType,
  tokenTypeDefaults,
  tokenTypeLabel,
  tryParseTokenRef,
} from "@/wab/commons/StyleToken";
import {
  assert,
  ensure,
  filterFalsy,
  precisionRound,
  spawn,
  unexpected,
} from "@/wab/shared/common";
import {
  siteFinalStyleTokens,
  TokenValueResolver,
} from "@/wab/shared/core/site-style-tokens";
import {
  FinalToken,
  MutableToken,
  OverrideableToken,
} from "@/wab/shared/core/tokens";
import * as css from "@/wab/shared/css";
import {
  createNumericSize,
  isValidUnit,
  showSizeCss,
} from "@/wab/shared/css-size";
import {
  checkAllowedUnits,
  formatDimCssFunction,
  validateDimCssFunction,
} from "@/wab/shared/css/css-tree-utils";
import { isDimCssFunction, LengthUnit } from "@/wab/shared/css/types";
import { StyleToken } from "@/wab/shared/model/classes";
import { naturalSort } from "@/wab/shared/sort";
import { canCreateAlias } from "@/wab/shared/ui-config-utils";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { notification, Tooltip } from "antd";
import type { TooltipPlacement } from "antd/es/tooltip";
import cn from "classnames";
import { useCombobox, UseComboboxGetItemPropsOptions } from "downshift";
import L from "lodash";
import { useStyleTokenCatalogInputs, useTokenPickerPermissions } from "@/wab/client/studio-ctx/style-token-catalog-inputs";
import { useColorTokenChoiceInputs } from "@/wab/client/studio-ctx/color-token-choice-inputs";
import React from "react";
import {
  AriaPositionProps,
  useInteractOutside,
  useOverlayPosition,
} from "react-aria";
import ReactDOM from "react-dom";
import { VariableSizeList } from "react-window";

export interface DimTokenSpinnerRef {
  focus: () => void;
}

function MiddleEllipsis({
  children,
  matcher,
  tailLength,
}: {
  children: string;
  matcher: Matcher;
  tailLength: number;
}) {
  const [head, tail] = React.useMemo(
    () =>
      children
        .match(
          new RegExp(
            `^(.+?)(.{${Math.min(
              Math.floor(children.length / 2),
              tailLength,
            )}})$`,
          ),
        )
        ?.slice(1) ?? [],
    [children, tailLength],
  );
  return (
    <div style={{ display: "flex", width: "100%" }}>
      {matcher.boldSnippets(
        <>
          <span
            style={{
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {head}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>{tail}</span>
        </>,
      )}
    </div>
  );
}

/** Synchronous intent shared by Downshift's focus, selection and blur events. */
class DimSpinnerInteraction {
  private skipBlur = false;
  private selectClick = false;
  shouldSaveBlur() { return !this.skipBlur; }
  suppressBlur() { this.skipBlur = true; }
  focus() { this.skipBlur = false; this.selectClick = true; }
  consumeClickSelection() { const select = this.selectClick; this.selectClick = false; return select; }
}

const DimTokenSpinnerContent = React.forwardRef(function DimTokenSpinner(
    props: {
      className?: string;
      "data-test-id"?: string;
      tokenType?: StyleTokenType;
      fieldAriaProps?: FieldAriaProps;
      studioCtx?: StudioCtx;
      dropdownPlacement?: AriaPositionProps["placement"];
      minDropdownWidth?: number;
      maxDropdownWidth?: number;
      autoFocus?: boolean;
      showDropdownOnFocus?: boolean;
      hideArrow?: boolean;
      disabled?: boolean;
      styleType?: PlasmicDimTokenSelector__VariantsArgs["styleType"];
      valueSetState?: ValueSetState;
      onEscape?: (e: React.KeyboardEvent) => void;
      placeholder?: string;
      disabledTooltip?: React.ReactNode | (() => React.ReactNode);
      tooltip?: React.ReactNode | (() => React.ReactNode);
      tooltipPlacement?: TooltipPlacement;
      "data-plasmic-prop"?: string;
      onFocus?: () => void;
      onBlur?: () => void;
      disableSpin?: boolean;
      tokenInputs?: {
        readonly tokens: readonly FinalToken<StyleToken>[];
        readonly resolver: TokenValueResolver;
        readonly command: (token: FinalToken<StyleToken>) => FinalToken<StyleToken> | undefined;
        readonly permissions: ReturnType<typeof useTokenPickerPermissions>;
      };
    } & DimValueOpts,
    ref: React.Ref<DimTokenSpinnerRef>,
  ) {
    const { label: localizeLabel } = useI18n();
    const {
      value,
      tokenType,
      noClear,
      allowedUnits,
      extraOptions: _extraOptions = [],
      onChange,
      fieldAriaProps,
      studioCtx,
      dropdownPlacement = "bottom right",
      minDropdownWidth = 0,
      maxDropdownWidth = 1000,
      shorthand,
      autoFocus,
      showDropdownOnFocus,
      hideArrow,
      disabled,
      styleType,
      disabledTooltip,
      valueSetState,
      placeholder,
      onEscape,
      vsh,
      disableSpin,
    } = props;

    const owner = React.useMemo(() => studioCtx ? { models: studioCtx.modelSnapshots, lifetime: studioCtx.arenaState.lifetime() } : undefined, [studioCtx]);
    const isActive = () => !owner || !owner.lifetime.aborted && owner.models === studioCtx?.modelSnapshots;
    const extraOptions = _extraOptions.map((it) =>
      typeof it === "string" ? { value: it } : it,
    );

    if (tokenType && !studioCtx) {
      throw new Error("Must pass in studioCtx if using with tokens");
    }
    const tokens = props.tokenInputs?.tokens;

    const { displayValue, tryOnChange, spin, values } = useDimValue(props);
    const shorthandVals = shorthand ? css.toShorthandVals(values) : values;
    const parsedValues = tokens
      ? shorthandVals.map((v) => tryParseTokenRef(v, tokens) || v)
      : shorthandVals;
    const parsedTokens = parsedValues.filter(
      (v): v is FinalToken<StyleToken> => typeof v !== "string",
    );
    const editableTokens = parsedTokens.filter(
      (v) =>
        studioCtx?.site &&
        siteFinalStyleTokens(studioCtx.site).includes(v) &&
        !v.isRegistered,
    );

    const hasParsedToken = parsedTokens.length > 0;

    const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
    const rootRef = React.useMemo(() => ({ current: rootElement }), [rootElement]);
    const [inputElement, setInputElement] = React.useState<HTMLInputElement | null>(null);
    const [menuWidth, setMenuWidth] = React.useState(300);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const [list, setList] = React.useState<VariableSizeList | null>(null);

    const {
      value: typedInputValue,
      push: setTypedInputValue,
      handleKeyDown,
      reset,
    } = useUndo<string | undefined>(undefined);
    const [focused, setFocused] = React.useState(false);
    const inputValue =
      typedInputValue ??
      (hasParsedToken ? "" : focused ? value : localizeLabel(displayValue));

    const [editToken, setEditToken] = React.useState<
      MutableToken<StyleToken> | OverrideableToken<StyleToken> | undefined
    >(undefined);

    const [newToken, setNewToken] = React.useState<
      MutableToken<StyleToken> | undefined
    >(undefined);

    const isNumberMode = !isNaN(parseFloat(inputValue));
    const matcher = new Matcher(typedInputValue ?? "");
    const showCurrentToken = hasParsedToken && typedInputValue === undefined;
    const [interaction] = React.useState(() => new DimSpinnerInteraction());
    const [explicitHighlightedIndex, setExplicitHighlightedIndex] =
      React.useState<number | undefined>(undefined);

    React.useImperativeHandle(ref, () => ({
      focus() {
        inputElement?.focus();
      },
    }), [inputElement]);

    const makeUnitOptions = (): ConvertUnitItem[] => {
      if (typedInputValue && typedInputValue.length > 0) {
        return [];
      }
      const parsed = values.map((val) => css.parseCssNumericNew(val))[0];
      if (!parsed || parsed.num === undefined) {
        return [];
      }
      return [
        ...allowedUnits.filter(
          (unit) =>
            unit != parsed.units &&
            (css.typicalCssLengthUnits.has(unit) || unit === ""),
        ),
      ].map(
        (unit) =>
          ({
            type: "convert",
            value: `${parsed.num}${unit}`,
          }) as const,
      );
    };

    const makeExtraOptions = (): SetValueItem[] => {
      let options = extraOptions
        .filter((op) => !op.hide)
        .map((op) => ({ type: "value", value: op }) as const);

      if (!isNumberMode) {
        // If we're typing in words, then also filter this down by words
        options = options.filter((op) => {
          const caption =
            typeof op.value.label === "string"
              ? op.value.label
              : op.value.cleanLabel || op.value.value;
          return (
            matcher.matches(caption) || matcher.matches(localizeLabel(caption))
          );
        });
      }
      return options.map((it) => ({
        ...it,
        ...(it.value as any),
      }));
    };

    const resolver = props.tokenInputs?.resolver;

    const makeTokenOptions = (): (
      AddTokenItem | EditTokenItem | SelectTokenItem
    )[] => {
      if (!tokenType || !tokens || !resolver) {
        return [];
      }

      const selectedToken =
        editableTokens.length > 0 ? editableTokens[0] : undefined;

      return filterFalsy([
        // Always show create token option
        { type: "add-token" } as const,
        // Only show edit token option if , and
        inputValue.length === 0 && // the user hasn't typed anything yet
          selectedToken && // a token is currently selected
          studioCtx && // studioCtx if defined
          isStyleTokenEditable(
            selectedToken,
            vsh,
            props.tokenInputs?.permissions ?? studioCtx.getCurrentUiConfig(),
          ) && // the token is editable
          ({ type: "edit-token", token: selectedToken } as const),

        // show tokens that match name or value and have allowed units
        ...naturalSort(
          tokens
            .filter(
              (t) =>
                ((t.value && matcher.matches(t.value)) ||
                  matcher.matches(t.name)) &&
                checkAllowedUnits(
                  resolver(t, vsh),
                  allowedUnits as LengthUnit[],
                ),
            )
            .map((token) => ({ type: "token", token }) as const),
          (item) => item.token.name,
        ),
      ]);
    };

    const rawItems: RealItem[] = filterFalsy([
      // Always show clear option
      !noClear && ({ type: "clear" } as const),
      ...makeExtraOptions(),
      ...makeUnitOptions(),
      ...makeTokenOptions(),
    ]);

    const hasOptions =
      rawItems.length > 0 || !!tokenType || !noClear || extraOptions.length > 0;

    const virtualItems: VirtualItem[] = rawItems.map((item, itemIndex) => ({
      type: "action",
      item,
      itemIndex,
    }));

    const addTokenIndex = virtualItems.findIndex(
      (x) => x.type === "action" && x.item.type === "add-token",
    );

    const uiConfig = props.tokenInputs?.permissions ?? {};
    const canCreateToken = canCreateAlias(uiConfig, "token");
    if (addTokenIndex >= 0) {
      virtualItems.splice(
        addTokenIndex,
        canCreateToken ? 0 : 1,
        ...filterFalsy([
          addTokenIndex > 0 && ({ type: "separator" } as const),
          { type: "header" } as const,
        ]),
      );
    }

    const getDefaultHighlightedIndex = () => {
      if (!isNumberMode && typedInputValue && typedInputValue.length > 0) {
        const index = rawItems.findIndex(
          (item) => item.type === "value" || item.type === "token",
        );

        if (index >= 0) {
          return index;
        }
      }
      return -1;
    };

    const handleBlur = () => {
      if (interaction.shouldSaveBlur() && typedInputValue !== undefined) {
        tryOnChange(typedInputValue, "raw");
      }
      resetState();
      if (isOpen) {
        closeMenu();
      }
      setFocused(false);
    };

    // When DimTokenSelector is in a <FocusScope/>, we can't rely on blur events
    // to close the menu, because <FocusScope/> will force this input to be focused
    // if you try to blur it (something _must_ be focused in FocusScope). Thus, we
    // detect clicks outside and close the menu ourselves.
    useInteractOutside({
      ref: rootRef,
      onInteractOutside: (e) => {
        if (
          overlayRef.current &&
          overlayRef.current.contains(e.target as HTMLElement)
        ) {
          return;
        }
        handleBlur();
      },
    });

    const highlightedIndex =
      explicitHighlightedIndex ?? getDefaultHighlightedIndex();

    const {
      getInputProps,
      getItemProps,
      getComboboxProps,
      getMenuProps,
      getToggleButtonProps,
      isOpen,
      openMenu,
      closeMenu,
    } = useCombobox({
      inputValue,
      items: rawItems,
      highlightedIndex,
      labelId: fieldAriaProps?.["aria-labelledby"],
      inputId: fieldAriaProps?.id,
      onHighlightedIndexChange: (change) => {
        if (
          change.highlightedIndex !== undefined &&
          change.highlightedIndex >= 0
        ) {
          setExplicitHighlightedIndex(change.highlightedIndex);
        } else {
          setExplicitHighlightedIndex(undefined);
        }
      },
      onStateChange: (changes) => {
        if (disabled || !isActive()) {
          return;
        }
        if (
          changes.highlightedIndex != null &&
          list &&
          changes.type !== useCombobox.stateChangeTypes.MenuMouseLeave
        ) {
          // Make sure the highlighted item is revealed by the virtual list.  We need
          // to map from "items" index to "virtualItems" index here.
          const highlightedItem = rawItems[changes.highlightedIndex];
          const virtualIndex = virtualItems.findIndex(
            (item) => item.type === "action" && item.item === highlightedItem,
          );

          if (virtualIndex >= 0) {
            list.scrollToItem(virtualIndex, "smart");
          }
        }
        if (changes.type === useCombobox.stateChangeTypes.InputBlur) {
          handleBlur();
        }
        if (
          changes.type === useCombobox.stateChangeTypes.InputKeyDownEnter ||
          changes.type === useCombobox.stateChangeTypes.ItemClick
        ) {
          const selectedItem = changes.selectedItem;
          if (selectedItem) {
            if (
              selectedItem.type === "value" ||
              selectedItem.type === "convert"
            ) {
              tryOnChange(selectedItem.value, "selected");
            } else if (selectedItem.type === "clear") {
              tryOnChange(undefined, "selected");
            } else if (selectedItem.type === "token") {
              const token = props.tokenInputs?.command(selectedItem.token);
              if (!token) { return; }
              onChange(mkTokenRef(token.base), "selected");
            } else if (selectedItem.type === "add-token") {
              spawn(
                ensure(
                  studioCtx,
                  "DimTokenSelector expects to have studioCtx if adding token",
                ).changeUnsafe(() => {
                  if (!isActive()) { return; }
                  const startValue = css.parseCssNumericNew(inputValue)
                    ? css.autoUnit(inputValue, [...allowedUnits][0], value)
                    : tokenTypeDefaults(
                        ensure(
                          tokenType,
                          "tokenType must not be null when adding token",
                        ),
                      );
                  const _newToken = ensure(
                    studioCtx,
                    "DimTokenSelector expects to have studioCtx if adding token",
                  )
                    .tplMgr()
                    .addStyleToken({
                      tokenType: ensure(
                        tokenType,
                        "tokenType must not be null when adding token",
                      ),
                      value: startValue,
                    });

                  onChange(mkTokenRef(_newToken), "selected");
                  setNewToken(new MutableToken(_newToken));
                }),
              );
            } else if (selectedItem.type === "edit-token") {
              const token = props.tokenInputs?.command(selectedItem.token);
              if (token && isStyleTokenEditable(token, vsh, studioCtx?.getCurrentUiConfig() ?? {})) { setEditToken(token); }
            }
          }
          interaction.suppressBlur();
          resetState();
        }
        if (changes.type === useCombobox.stateChangeTypes.InputKeyDownEscape) {
          interaction.suppressBlur();
          resetState();
        }
      },
    });

    const { overlayProps: overlayPositionProps } = useOverlayPosition({
      targetRef: rootRef,
      overlayRef,
      placement: dropdownPlacement,
      offset: 5,
      isOpen: isOpen,
    });

    useOnContainerScroll({
      ref: rootRef,
      onScroll: () => {
        closeMenu();
      },
      disabled: !isOpen,
    });

    const menuProps = getMenuProps({
      "aria-label": fieldAriaProps?.["aria-label"],
    });

    const itemSizer = (index: number) => {
      const item = virtualItems[index];
      if (!item) {
        return 0;
      } else if (item.type === "header") {
        return 44;
      } else if (item.type === "separator") {
        return 1;
      } else {
        return 32;
      }
    };

    const height = Math.min(
      200,
      L.sum(L.range(virtualItems.length).map(itemSizer)),
    );

    const resetState = () => {
      reset();
      setExplicitHighlightedIndex(undefined);
    };

    React.useLayoutEffect(() => {
      if (!rootElement) { setMenuWidth(300); return; }
      const measure = () => setMenuWidth(Math.min(maxDropdownWidth, Math.max(rootElement.offsetWidth, minDropdownWidth)));
      measure();
      const resize = new ResizeObserver(measure);
      resize.observe(rootElement);
      return () => resize.disconnect();
    }, [rootElement, minDropdownWidth, maxDropdownWidth]);

    return (
      <>
        <MaybeWrap
          cond={!!props.tooltip}
          wrapper={(x) => (
            <Tooltip title={props.tooltip} placement={props.tooltipPlacement}>
              <TriggerTarget>{x as React.ReactElement}</TriggerTarget>
            </Tooltip>
          )}
        >
          <PlasmicDimTokenSelector
            valueSetState={
              valueSetState === "isUnset" && typedInputValue
                ? "isSet"
                : valueSetState
            }
            showDropdownArrow={hasOptions && !hideArrow}
            showCurrentTokens={showCurrentToken}
            styleType={styleType}
            textbox={{
              ...getInputProps({
                onFocus: (e) => {
                  props.onFocus?.();
                  if (!isOpen && showDropdownOnFocus) {
                    openMenu();
                  }
                  e.target.select();
                  interaction.focus();
                  setFocused(true);
                },
                onClick: (e) => {
                  if (interaction.consumeClickSelection()) {
                    const input = e.currentTarget;
                    // Defer selection to after all event handlers complete
                    setTimeout(() => {
                      input.select();
                    }, 0);
                  }
                },
                onBlur: () => {
                  props.onBlur?.();
                },
                onKeyDown: (e) => {
                  openMenu();

                  if (handleKeyDown(e)) {
                    return;
                  }

                  if (e.key === "Escape") {
                    if (isOpen) {
                      interaction.suppressBlur();
                      e.stopPropagation();
                      resetState();
                      closeMenu();
                      onEscape && onEscape(e);
                    }
                  } else if (e.key === "Enter") {
                    interaction.suppressBlur();
                    const isValidInput =
                      isNumberMode ||
                      isDimCssFunction(inputValue) ||
                      extraOptions.some(
                        (option) => option.value === inputValue,
                      );
                    if (isValidInput && tryOnChange(inputValue, "raw")) {
                      resetState();
                      closeMenu();
                    }
                  } else if (isNumberMode && !disableSpin) {
                    (e.nativeEvent as any).preventDownshiftDefault = true;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      spin("up", e.shiftKey);
                      resetState();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      spin("down", e.shiftKey);
                      resetState();
                    }
                  }
                },
                onChange: (e) => {
                  setTypedInputValue(e.currentTarget.value);
                  if (list) {
                    // Item sizes are cached on the virtual list, so if list members change,
                    // we need to invalidate the cache
                    list.resetAfterIndex(0, true);
                  }
                },
                ref: setInputElement,
                autoFocus,
                disabled,
                placeholder: placeholder
                  ? localizeLabel(placeholder)
                  : undefined,
              }),

              style: showCurrentToken ? { width: 0, padding: 0 } : undefined,
              "data-test-id": props["data-test-id"] ?? `${tokenType}-input`,
              "data-plasmic-prop": props["data-plasmic-prop"],
            }}
            existingTokensContainer={{
              props: {
                key: `${parsedValues
                  .map((val) => (typeof val === "string" ? val : val.uuid))
                  .join("-")}`,
              },
            }}
            existingTokens={parsedValues.map((val) =>
              typeof val === "string" ? (
                <div key={val} className="text-ellipsis">
                  {localizeLabel(val)}
                </div>
              ) : (
                <Chip
                  key={val.uuid}
                  tooltip={`${val.name} (${derefToken(
                    ensure(tokens, "tokens is expected to be not null"),
                    val,
                    vsh,
                  )})`}
                >
                  {val.name}
                </Chip>
              ),
            )}
            root={{
              props: {
                ...getComboboxProps({
                  ref: setRootElement,
                  className: cn("overflow-hidden", props.className),
                  ...(disabled
                    ? {}
                    : {
                        onClick: () => {
                          if (inputElement) {
                            inputElement.focus();
                          }
                          if (!isOpen) {
                            openMenu();
                          }
                        },
                      }),
                }),
              },

              wrap: (elt) => {
                if (disabled && disabledTooltip) {
                  return (
                    <Tooltip title={disabledTooltip}>
                      <TriggerTarget>{elt}</TriggerTarget>
                    </Tooltip>
                  );
                } else {
                  return elt;
                }
              },
            }}
            dropdownToggle={{
              disabled: disabled,
              ...getToggleButtonProps(),
            }}
            disabled={disabled}
          />
        </MaybeWrap>

        {ReactDOM.createPortal(
          isOpen && hasOptions ? (
            <DropdownOverlay
              scrollable={false}
              ref={overlayRef}
              {...overlayPositionProps}
              style={{
                position: "absolute",
                overflow: "hidden",
                maxHeight: "80vh",
                ...overlayPositionProps.style,
              }}
            >
              <ul {...menuProps}>
                {isOpen && (
                  <DimTokenContext.Provider
                    value={{
                      matcher,
                      getItemProps,
                      highlightedItemIndex: highlightedIndex,
                      tokenType,
                      vsh,
                      resolver,
                    }}
                  >
                    <VariableSizeList
                      outerElementType={VirtualListScrollbar}
                      ref={setList}
                      itemData={virtualItems}
                      itemCount={virtualItems.length}
                      estimatedItemSize={32}
                      height={height}
                      width={menuWidth}
                      overscanCount={2}
                      itemSize={itemSizer}
                    >
                      {Row}
                    </VariableSizeList>
                  </DimTokenContext.Provider>
                )}
              </ul>
            </DropdownOverlay>
          ) : (
            <ul {...menuProps} hidden />
          ),
          document.body,
        )}

        {editToken && (
          <GeneralTokenEditModal
            studioCtx={ensure(
              studioCtx,
              "studioCtx is expected to be not null if editing token",
            )}
            token={editToken}
            onClose={() => {
              setEditToken(undefined);
              closeMenu();
            }}
            vsh={vsh}
          />
        )}

        {newToken && (
          <GeneralTokenEditModal
            studioCtx={ensure(
              studioCtx,
              "studioCtx is expected to be not null if adding token",
            )}
            token={newToken}
            defaultEditingName={true}
            onClose={() => {
              setNewToken(undefined);
              closeMenu();
            }}
            vsh={vsh}
          />
        )}
      </>
    );
  });

type DimTokenSpinnerProps = Omit<React.ComponentPropsWithoutRef<typeof DimTokenSpinnerContent>, "tokenInputs">;

export const DimTokenSpinner = React.memo(React.forwardRef<DimTokenSpinnerRef, DimTokenSpinnerProps>(function DimTokenSpinner(props, ref) {
  const catalog = useStyleTokenCatalogInputs(props.studioCtx, props.tokenType, props.vsh);
  const permissions = useTokenPickerPermissions(props.studioCtx);
  if (catalog.source && !catalog.source.isActive()) { return null; }
  return props.studioCtx ? <NativeDimTokenSpinner {...props} studio={props.studioCtx} tokens={catalog.tokens} permissions={permissions} inputRef={ref} key={catalog.source?.key} /> : <DimTokenSpinnerContent {...props} ref={ref} />;
}));

function NativeDimTokenSpinner({ studio, inputRef, tokens, permissions, ...props }: DimTokenSpinnerProps & { studio: StudioCtx; tokens: readonly FinalToken<StyleToken>[]; inputRef: React.Ref<DimTokenSpinnerRef>; permissions: ReturnType<typeof useTokenPickerPermissions> }) {
  const helper = React.useMemo(() => props.vsh ?? new VariantedStylesHelper(), [props.vsh]);
  const values = useColorTokenChoiceInputs(studio, tokens, helper);
  const clientValues = useClientTokenValues(values.snapshot.choices.map((choice) => choice.resolved), values.lifetime);
  const resolver = React.useMemo<TokenValueResolver>(() => (token) => ensure(clientValues[tokens.indexOf(token)], "Dimension token must belong to its captured choices"), [clientValues, tokens]);
  return values.snapshot.active ? <DimTokenSpinnerContent {...props} ref={inputRef} tokenInputs={{ tokens, resolver, permissions, command: (token) => { const choice = values.snapshot.choices[tokens.indexOf(token)]; return choice && values.command(choice); } }} /> : null;
}

interface SelectTokenItem {
  type: "token";
  token: FinalToken<StyleToken>;
}

interface AddTokenItem {
  type: "add-token";
}

interface EditTokenItem {
  type: "edit-token";
  token: MutableToken<StyleToken> | OverrideableToken<StyleToken>;
}

interface SetValueItem {
  type: "value";
  value: string;
}

interface ClearValueItem {
  type: "clear";
}

interface ConvertUnitItem {
  type: "convert";
  value: string;
}

type RealItem =
  | SelectTokenItem
  | AddTokenItem
  | EditTokenItem
  | SetValueItem
  | ClearValueItem
  | ConvertUnitItem;

interface TokenHeaderItem {
  type: "header";
}

interface SeparatorItem {
  type: "separator";
}

interface ActionItem {
  type: "action";
  item: RealItem;
  itemIndex: number;
}

type VirtualItem = TokenHeaderItem | SeparatorItem | ActionItem;

interface DimTokenContextValue {
  allTokens?: StyleToken[];
  matcher: Matcher;
  getItemProps: (options: UseComboboxGetItemPropsOptions<any>) => any;
  highlightedItemIndex: number;
  tokenType?: StyleTokenType;
  vsh?: VariantedStylesHelper;
  resolver?: TokenValueResolver;
}

const DimTokenContext = React.createContext<DimTokenContextValue | undefined>(
  undefined,
);

const Row = React.memo(function Row(props: {
  data: VirtualItem[];
  index: number;
  style: React.CSSProperties;
}) {
  const { t: uiT, label: localizeLabel } = useI18n();
  const { data, index, style } = props;
  const item = data[index];
  const context = ensure(
    React.useContext(DimTokenContext),
    "DimTokenContext is expected to be not nullish",
  );
  const {
    matcher,
    getItemProps,
    highlightedItemIndex,
    tokenType,
    vsh,
    resolver,
  } = context;

  if (item.type === "header") {
    return (
      <ListSectionHeader style={style}>
        {tokenTypeLabel(
          ensure(tokenType, "tokenType is expected to be not null"),
        )}{" "}
        <UiText message={"Tokens"} />
      </ListSectionHeader>
    );
  } else if (item.type === "separator") {
    return <ListSectionSeparator style={style} />;
  } else {
    const action = item.item;
    const isFocused = highlightedItemIndex === item.itemIndex;
    const itemProps = {
      ...getItemProps({ item, index: item.itemIndex }),
      role: "option",
      style: style,
    };

    if (action.type === "token") {
      const realValue = ensure(resolver, "Dimension token rows require their captured native resolver")(action.token, vsh);
      return (
        <Tooltip title={action.token.name} placement="left" open={isFocused}>
          <li {...itemProps} aria-label={action.token.name}>
            <ListItem
              isFocused={isFocused}
              showAddendums
              addendum={
                <code>
                  <MiddleEllipsis tailLength={8} matcher={matcher}>
                    {realValue}
                  </MiddleEllipsis>
                </code>
              }
              hideIcon
            >
              <MiddleEllipsis tailLength={8} matcher={matcher}>
                {action.token.name}
              </MiddleEllipsis>
            </ListItem>
          </li>
        </Tooltip>
      );
    } else if (action.type === "value") {
      return (
        <li {...itemProps} aria-label={action.value}>
          <ListItem isFocused={isFocused} hideIcon>
            {typeof (action as any).label === "string"
              ? localizeLabel((action as any).label)
              : (action as any).label ||
                matcher.boldSnippets(localizeLabel(action.value))}
          </ListItem>
        </li>
      );
    } else if (action.type === "clear") {
      return (
        <li {...itemProps} aria-label={uiT("Unset")}>
          <ListItem isFocused={isFocused} hideIcon>
            <em>
              <UiText message={"(Unset)"} />
            </em>
          </ListItem>
        </li>
      );
    } else if (action.type === "convert") {
      return (
        <li {...itemProps} aria-label={action.value}>
          <ListItem
            isFocused={isFocused}
            // showAddendums
            // addendum={<code>{action.value}</code>}
            hideIcon
          >
            <span>
              <UiText
                message={"Convert to {part1}"}
                values={{ part1: <strong>{action.value}</strong> }}
              />
            </span>
          </ListItem>
        </li>
      );
    } else if (action.type === "add-token") {
      return (
        <li {...itemProps} aria-label={uiT("Add new token")}>
          <ListItem isFocused={isFocused} icon={<Icon icon={PlusCircleIcon} />}>
            <UiText message={"Create new token..."} />
          </ListItem>
        </li>
      );
    } else if (action.type === "edit-token") {
      return (
        <li
          {...itemProps}
          aria-label={uiT('Edit token "{name}"', { name: action.token.name })}
        >
          <ListItem isFocused={isFocused} icon={<Icon icon={PencilIcon} />}>
            <UiText
              message={'Edit token "{name}"'}
              values={{ name: action.token.name }}
            />
          </ListItem>
        </li>
      );
    }
    throw unexpected();
  }
});

type ChangeType = "raw" | "spin" | "selected";

export interface DimValueOpts {
  value: string;
  onChange: (value: string | undefined, type: ChangeType) => void;
  extraOptions?: (
    | {
        value: string;
        label?: React.ReactNode;
        cleanLabel?: string;
        hide?: boolean;
      }
    | string
  )[];
  shorthand?: boolean;
  noClear?: boolean;
  allowedUnits: readonly string[];
  allowFunctions: boolean;
  min?: number;
  max?: number;
  delta?: number;
  fractionDigits?: number;
  displayedFractionDigits?: number;
  vsh?: VariantedStylesHelper;

  /**
   * Custom validation function. If provided, overrides default dimension validation.
   * Return { valid: true } if valid, or { valid: false, error: "message" } if invalid.
   */
  validate?: (value: string) => { valid: boolean; error?: string };

  /**
   * Custom transformation/normalization function.
   * Applied before saving the value.
   */
  transform?: (value: string) => string;
}

function useDimValue(opts: DimValueOpts) {
  const { t: studioUiT } = useI18n();

  const {
    value,
    onChange,
    extraOptions: _extraOptions = [],
    shorthand,
    noClear,
    allowedUnits,
    allowFunctions,
    min = Number.NEGATIVE_INFINITY,
    max = Infinity,
    delta = 1,
    fractionDigits = 3,
    displayedFractionDigits = 3,
    validate: customValidate,
    transform: customTransform,
  } = opts;

  const allowedUnitsSet = new Set(allowedUnits);
  const preferredUnit =
    ["", ...css.typicalCssLengthUnits].find((u) => allowedUnitsSet.has(u)) ??
    allowedUnits[0];

  const extraOptions = _extraOptions.map((it) =>
    typeof it === "string" ? { value: it } : it,
  );

  const values = shorthand ? css.parseCssShorthand(value) : [value];

  function showUnitError(newValue: string) {
    notification.error({
      message: studioUiT('Invalid value "{part1}"', {
        part1: String(newValue),
      }),
      description: studioUiT("Must use one of these units - {part1}.", {
        part1: String(allowedUnits.join(", ")),
      }),
    });
  }


  function checkValidValue(val: string) {
    if (extraOptions.some((it) => it.value === val)) {
      return true;
    }

    if (customValidate) {
      const result = customValidate(val);
      if (result.valid) {
        return true;
      }
      showError(result.error || "Invalid value", {
        title: studioUiT("Invalid value"),
      });
      return false;
    }

    const newValues = shorthand ? css.parseCssShorthand(val) : [val];
    for (const newValue of newValues) {
      const formattedValue = formatDimCssFunction(newValue);
      if (allowFunctions && isDimCssFunction(formattedValue)) {
        const result = validateDimCssFunction(formattedValue, allowedUnits);
        if (!result.valid) {
          showError(result.error, { title: studioUiT("Invalid value") });
          return false;
        }
        continue;
      }
      const parsed = css.parseCssNumericNew(newValue);

      if (!parsed) {
        notification.error({
          message: studioUiT('Invalid value "{part1}"', {
            part1: String(newValue),
          }),
          description: studioUiT("Must be a numeric value"),
        });

        return false;
      }

      const hasValidUnit =
        allowedUnits.includes(parsed.units) ||
        (allowedUnits.length === 0 && parsed.units.length === 0);
      if (!hasValidUnit) {
        showUnitError(newValue);
        return false;
      }

      if (parsed.num > max) {
        notification.error({
          message: studioUiT('Invalid value "{part1}"', {
            part1: String(newValue),
          }),
          description: studioUiT("Must be less than {part1}.", {
            part1: String(max),
          }),
        });

        return false;
      }

      if (parsed.num < min) {
        notification.error({
          message: studioUiT('Invalid value "{part1}"', {
            part1: String(newValue),
          }),
          description: studioUiT("Must be greater than {part1}.", {
            part1: String(min),
          }),
        });

        return false;
      }
    }

    return true;
  }

  function roundValue(val: string) {
    const parsed = css.parseCssNumericNew(val);
    if (parsed) {
      parsed.num = precisionRound(parsed.num, Math.min(fractionDigits, 4));
      return css.showCssNumericNew(parsed);
    } else {
      return val;
    }
  }

  const formatFunctionOrRoundValue = (val: string) => {
    return isDimCssFunction(val) ? formatDimCssFunction(val) : roundValue(val);
  };


  function tryChange(newValue: string | undefined, type: ChangeType) {
    if (newValue === undefined) {
      assert(!noClear, "noClear must be false to clear value");
      onChange(undefined, type);
      return true;
    }
    newValue = newValue.trim();
    if (!checkValidValue(newValue)) {
      return false;
    }

    if (customTransform) {
      newValue = customTransform(newValue);
    } else if (shorthand) {
      newValue = css.showCssShorthand(
        css
          .parseCssShorthand(newValue)
          .map((val) => formatFunctionOrRoundValue(val)),
      );
    } else {
      newValue = formatFunctionOrRoundValue(newValue);
    }

    onChange(newValue, type);
    return true;
  }

  function tryOnChange(val: string | undefined, type: ChangeType) {
    if (val === undefined) {
      return tryChange(val, type);
    }
    if (extraOptions.some((it) => it.value === val)) {
      return tryChange(val, type);
    }
    if (shorthand) {
      const newVals = css.parseCssShorthand(val);
      const autoVals = newVals.map((v, i) =>
        css.autoUnit(v, preferredUnit, values[i]),
      );

      return tryChange(css.showCssShorthand(autoVals), type);
    } else {
      const autoVal = css.autoUnit(val, preferredUnit, value);
      return tryChange(autoVal, type);
    }
  }

  const displayValue = isDimCssFunction(value)
    ? value
    : css.roundedCssNumeric(value, displayedFractionDigits);

  function spin(dir: "up" | "down", large?: boolean) {
    if (!value || isNaN(parseFloat(value))) {
      return;
    }
    const curParsed = css.parseCssNumericNew(value);
    const { num, units } = curParsed || {
      num: 0,
      units: preferredUnit,
    };

    const effectiveDelta =
      (large ? 10 * delta : delta) * (dir === "up" ? 1 : -1);
    const effectiveUnits = units || preferredUnit;

    if (!isValidUnit(effectiveUnits)) {
      showUnitError(value);
    } else {
      tryChange(
        showSizeCss(
          createNumericSize(
            Math.max(min, Math.min(+(num + effectiveDelta), max)),
            effectiveUnits,
          ),
        ),

        "spin",
      );
    }
  }

  return {
    displayValue,
    tryOnChange,
    spin,
    values,
  };
}

export default DimTokenSpinner;
