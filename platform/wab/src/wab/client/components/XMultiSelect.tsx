import { IconLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useFocusOnDisplayed } from "@/wab/client/dom-utils";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import ChevronDownsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__ChevronDownSvg";
import { MaybeWrap } from "@/wab/commons/components/ReactUtil";
import { arrayMoveIndex } from "@/wab/shared/collections";
import { cx, ensure, tuple } from "@/wab/shared/common";
import { Dropdown, Menu, Tooltip } from "antd";
import classNames from "classnames";
import Downshift, {
  ControllerStateAndHelpers,
  DownshiftProps,
} from "downshift";
import L from "lodash";
import React from "react";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import type { SetOptional } from "type-fest";

interface _XMultiSelectProps<Item> {
  fixedValues: Item[];
  focusedItem?: Item;
  itemKey: (item: Item | null) => string;
  onBlur?: (...args: any[]) => any;
  onOuterClick?: () => any;
  onClick?: (e: React.MouseEvent) => any;
  onFocusItem?: (item: Item) => void;
  onInputValueChange?: (text: string) => void;
  onSelect: (item: Item) => boolean | void;
  onUnselect: (item: Item) => any;
  options: Item[];
  renderInput: (props: {}) => any;
  renderOption: (item: Item) => React.ReactNode;
  renderSelectedItem: (item: Item, index: number) => React.ReactNode;
  selectedItems: Item[];
  showDropdownArrow: boolean;
  downshiftProps?: Partial<DownshiftProps<Item>>;
  autoFocus?: boolean;
  placeholder?: string;
  pillsFocusable?: boolean;
  className?: string;
  focusedClassName?: string;
  pillClassName?: string;
  pillSelectedClassName?: string;
  onReorder?: (from: number, to: number) => void;
  hideCloseButton?: boolean;
  filterOptions: (options: Item[], input: string | null) => Item[];
  isDisabled?: boolean;
  disabledTooltip?: React.ReactNode | (() => React.ReactNode);
  "data-plasmic-prop"?: string;
}
interface _XMultiSelectState<Item> {
  focused?: boolean;
  draggedItem?: Item;
  draggedFromIndex?: number;
  draggedToIndex?: number;
}
// antd 5 mounts overlay content while it is still display:none, so the input's
// autoFocus never fires when this is rendered inside a Popover or Dropdown.
function AutoFocuser(props: {
  inputBox: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  useFocusOnDisplayed(props.inputBox, { autoFocus: props.autoFocus });
  return null;
}

const defaults = {
    onSelect: L.noop,
    onUnselect: L.noop,
    itemKey: (item: any) => (item === null ? "" : `${item}`),
    options: [],
    renderInput: (props: React.ComponentProps<"input">) => <input {...props} className="transparent" />,
    renderOption: (item: any) => `${item}`,
    renderSelectedItem: (item: any) => `${item}`,
    selectedItems: [],
    showDropdownArrow: false,
    fixedValues: [],
    pillsFocusable: false,
  };

function HighlightFirstOption({ highlightedIndex, isInputEmpty, highlight }: { highlightedIndex: number | null; isInputEmpty: boolean; highlight: (index: number) => void }) {
  React.useEffect(() => { if (highlightedIndex === null && !isInputEmpty) { highlight(0); } }, [highlightedIndex, isInputEmpty, highlight]);
  return null;
}

function XMultiSelectContent<Item>(props: _XMultiSelectProps<Item>) {
  const [state, updateState] = React.useState<_XMultiSelectState<Item>>({});
  const setState = (values: Partial<_XMultiSelectState<Item>>) => updateState((previous) => ({ ...previous, ...values }));
  const [inputElement, setInputElement] = React.useState<HTMLInputElement | null>(null);
  const inputBox = React.useMemo(() => ({ current: inputElement }), [inputElement]);
  const handleDragStart = (e: React.DragEvent, item: Item, index: number) => {
    setState({ draggedItem: item, draggedFromIndex: index });
    return true;
  };

  const handleDragOverOrEnter = (
    e: React.DragEvent,
    item: Item,
    index: number,
  ) => {
    if (index !== state.draggedToIndex) {
      e.stopPropagation();
      e.preventDefault();
      setState({
        draggedToIndex: index,
      });
    }
  };

  const handleDragEnd = (_e: React.DragEvent) => {
    const fromIndex = ensure(
      state.draggedFromIndex,
      "Unexpected undefined draggedFromIndex. Should be not null to handle drag end",
    );
    const toIndex = state.draggedToIndex;
    setState({
      draggedItem: undefined,
      draggedToIndex: undefined,
      draggedFromIndex: undefined,
    });
    if (toIndex !== undefined && fromIndex !== toIndex) {
      ensure(
        props.onReorder,
        "Unexpected undefined onReorder. If drag is enable should have onReorder method",
      )(fromIndex, toIndex);
    }
  };

  function dragReorderedItems() {
    const selectedItems = props.selectedItems;
    if (state.draggedItem && state.draggedToIndex !== undefined) {
      return arrayMoveIndex(
        selectedItems,
        ensure(
          state.draggedFromIndex,
          "Unexpected undefined draggedFromIndex. Should be not null to drag reordered items",
        ),
        state.draggedToIndex,
      );
    } else {
      return selectedItems;
    }
  }

    const {
      downshiftProps,
      fixedValues,
      focusedItem,
      itemKey,
      onFocusItem,
      onInputValueChange,
      onSelect,
      onUnselect,
      options,
      renderInput,
      renderOption,
      renderSelectedItem,
      selectedItems,
      onBlur,
      onOuterClick,
      autoFocus,
      placeholder,
      pillsFocusable,
      onReorder,
      filterOptions,
      isDisabled,
      disabledTooltip,
      onClick,
    } = props;
    const reorderedItems = dragReorderedItems();
    const handleSelect = (
      item: Item | null,
      downshift: ControllerStateAndHelpers<Item>,
    ) => {
      if (item && !selectedItems.includes(item)) {
        const closeOnSelect = onSelect(item);
        downshift.reset();
        if (!closeOnSelect) {
          downshift.openMenu();
        }
      }
    };
    return (
      <Downshift<Item>
        itemToString={itemKey}
        onChange={handleSelect}
        initialHighlightedIndex={0}
        selectedItem={null}
        onInputValueChange={onInputValueChange}
        onOuterClick={onOuterClick}
        {...downshiftProps}
      >
        {(downshift) => {
          const { getInputProps, getRootProps } = downshift;
          const isInputEmpty =
            !downshift.inputValue || downshift.inputValue.trim().length === 0;
          const renderOptions = filterOptions(options, downshift.inputValue);
          const curItem =
            renderOptions.length > 0 && downshift.highlightedIndex !== null
              ? renderOptions[downshift.highlightedIndex]
              : undefined;
          return (
            <MaybeWrap
              cond={!!isDisabled && !!disabledTooltip}
              wrapper={(x) => (
                <Tooltip title={disabledTooltip}>
                  <TriggerTarget>{x}</TriggerTarget>
                </Tooltip>
              )}
            >
              <div
                className={cx("dropdown-container flex", props.className, { "dropdown-container--focused": state.focused }, state.focused && props.focusedClassName)}
                data-plasmic-prop={props["data-plasmic-prop"]}
                {...getRootProps(undefined, { suppressRefError: true })}
              >
                <AutoFocuser inputBox={inputBox} autoFocus={autoFocus} />
                <HighlightFirstOption highlightedIndex={downshift.highlightedIndex} isInputEmpty={isInputEmpty} highlight={downshift.setHighlightedIndex} />
                <Dropdown
                  open={downshift.isOpen && renderOptions.length > 0}
                  // We compartmentalize the Ant dropdown menu item padding style tweaks into .xselect.
                  // Don't want to globally affect all Ant dropdown menus.
                  overlayClassName="xselect"
                  popupRender={() => (
                    <Scrollbar style={{ maxHeight: "30vh" }}><Menu
                      className={"ant-select-dropdown-menu"}
                      style={{ overflow: "visible", maxHeight: "none" }}
                      selectedKeys={[curItem ? itemKey(curItem) : ""]}
                    >
                      {renderOptions.map((item: Item, index: number) => {
                        const key = itemKey(item);
                        return (
                          <Menu.Item key={key}>
                            <div
                              {...downshift.getItemProps({
                                item,
                                index,
                              })}
                            >
                              {renderOption(item)}
                            </div>
                          </Menu.Item>
                        );
                      })}
                    </Menu></Scrollbar>
                  )}
                >
                  <div
                    className="flex flex-vcenter flex-wrap flex-fill"
                    onMouseDown={(e) => {
                      // This appears as part of the normal textbox.  If the user was focused on the textbox and then clicks here,
                      // no blur (however brief) should happen.
                      //
                      // From <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus>:
                      // "If you call HTMLElement.focus() from a mousedown event handler, you must call
                      // event.preventDefault() to keep the focus from leaving the HTMLElement."
                      //
                      // Only do this for clicks on the container itself.  Clicks within the input box should not be
                      // interfered with (e.g. moving the I-beam), and clicks on the pills should not trigger focus and
                      // should be able to steal focus.
                      if (e.target === e.currentTarget) {
                        ensure(
                          inputElement,
                          "Unexpected undefined inputBox.current",
                        ).focus();
                        e.preventDefault();
                      }
                    }}
                  >
                    {reorderedItems.map((item: Item, index) => {
                      const isFocusedItem =
                        pillsFocusable && focusedItem === item;
                      return (
                        <div
                          key={itemKey(item)}
                          className={cx("dropdown-pill", props.pillClassName, { "dropdown-pill--selected": isFocusedItem || item === state.draggedItem }, (isFocusedItem || item === state.draggedItem) && props.pillSelectedClassName)}
                          draggable={
                            !!onReorder && state.draggedItem !== item
                          }
                          onDragStart={
                            onReorder &&
                            ((e) => handleDragStart(e, item, index))
                          }
                          onDragOver={
                            onReorder &&
                            ((e) => handleDragOverOrEnter(e, item, index))
                          }
                          onDragEnter={
                            onReorder &&
                            ((e) => handleDragOverOrEnter(e, item, index))
                          }
                          onDragEnd={onReorder && handleDragEnd}
                          onDrop={
                            onReorder &&
                            (() => {
                              // We need to have a drop handler for this pill to be a valid drop target,
                              // but we don't actually need to do anything, as we handle the actual move
                              // in onDragEnd.
                            })
                          }
                          data-test-id={"multi-select-value"}
                        >
                          <span
                            className={classNames({
                              "dropdown-pill__contents": true,
                              "dropdown-pill__contents--clickable":
                                !!onFocusItem,
                            })}
                            onClick={() => {
                              if (onFocusItem) {
                                onFocusItem(item);
                                downshift.closeMenu();
                              }
                            }}
                          >
                            {renderSelectedItem(item, index)}
                          </span>

                          {!fixedValues.includes(item) &&
                            !props.hideCloseButton && (
                              <>
                                <IconLinkButton
                                  className={cx({
                                    "dropdown-pill__deleter": true,
                                    inverted: isFocusedItem,
                                  })}
                                  onMouseDown={(e) => {
                                    // Using onMouseDown instead of onClick to be ahead of
                                    // input element's blur event.  With onClick, sometimes
                                    // this fires before onBlur and sometiems after, not sure
                                    // why...
                                    e.preventDefault();
                                    onUnselect(item);
                                  }}
                                >
                                  <Icon
                                    icon={CloseIcon}
                                    className="no-line-height"
                                  />
                                </IconLinkButton>
                              </>
                            )}
                        </div>
                      );
                    })}

                    <div className={"dropdown-input-container"}>
                      {renderInput(
                        getInputProps({
                          ref: setInputElement,
                          disabled: isDisabled,
                          onClick: (e: React.MouseEvent) => {
                            // Always open the menu when clicked, even if already focused
                            downshift.openMenu();
                            onClick?.(e);
                          },
                          onBlur: (e) => {
                            setState({ focused: false });
                            if (onBlur) {
                              onBlur(e);
                            }
                          },
                          autoFocus,
                          onFocus: () => {
                            downshift.openMenu();
                            setState({ focused: true });
                          },
                          placeholder:
                            selectedItems.length === 0
                              ? placeholder
                              : undefined,
                          className: "textbox--transparent",
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key === "Escape" && inputElement) {
                              inputElement.blur();
                              e.stopPropagation();
                            }
                            if (
                              (e.key === "Delete" || e.key === "Backspace") &&
                              isInputEmpty
                            ) {
                              const last = L.last(selectedItems);
                              if (last) {
                                onUnselect(last);
                              }
                            }
                            if (
                              e.key === "Enter" &&
                              !curItem &&
                              inputElement
                            ) {
                              inputElement.blur();
                            }
                          },
                        }),
                      )}{" "}
                      {props.showDropdownArrow ? (
                        <div className="xmultiselect-arrow flex-center">
                          {/* NOTE: We pass an explicit style to Icon so the inline width/height override the default square 16×16 size of the Icon component */}
                          <Icon
                            icon={ChevronDownsvgIcon}
                            style={{ height: 10, width: 16 }}
                          />
                        </div>
                      ) : undefined}
                    </div>
                  </div>
                </Dropdown>
              </div>
            </MaybeWrap>
          );
        }}
      </Downshift>
    );
}

type RawProps = typeof defaults;

type XMultiSelectProps<Item> = SetOptional<
  _XMultiSelectProps<Item>,
  keyof RawProps
> & {
  onClick?: (e: React.MouseEvent) => void;
  selectedItems?: Item[];
  defaultSelectedItems?: Item[];

  focusedItem?: Item;
  defaultFocusedItem?: Item;
};

export function XMultiSelect<Item>(props: XMultiSelectProps<Item>) {
  const [selectedItems, setSelectedItems] = React.useState<Item[]>(() => props.defaultSelectedItems ?? []);
  const [focusedItem, setFocusedItem] = React.useState<Item | undefined>(() => props.defaultFocusedItem);
  const controlledSelection = props.selectedItems !== undefined;
  return <XMultiSelectContent<Item>
    {...props}
    fixedValues={props.fixedValues ?? defaults.fixedValues}
    options={props.options ?? defaults.options}
    itemKey={props.itemKey ?? defaults.itemKey}
    renderInput={props.renderInput ?? defaults.renderInput}
    renderOption={props.renderOption ?? defaults.renderOption}
    renderSelectedItem={props.renderSelectedItem ?? defaults.renderSelectedItem}
    showDropdownArrow={props.showDropdownArrow ?? false}
    pillsFocusable={props.pillsFocusable ?? false}
    selectedItems={props.selectedItems ?? selectedItems}
    onSelect={controlledSelection ? props.onSelect ?? L.noop : (item) => setSelectedItems((previous) => tuple(...previous, item))}
    onUnselect={controlledSelection ? props.onUnselect ?? L.noop : (item) => setSelectedItems((previous) => L.without(previous, item))}
    onFocusItem={props.onFocusItem ?? setFocusedItem}
    focusedItem={props.onFocusItem ? props.focusedItem : focusedItem}
  />;
}
