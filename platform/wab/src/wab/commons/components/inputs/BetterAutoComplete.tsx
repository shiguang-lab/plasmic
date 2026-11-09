import {
  callEventHandlers,
  useCommittedValue,
} from "@/wab/commons/components/ReactUtil";
import sty from "@/wab/commons/components/inputs/BetterAutoComplete.module.css";
import { Cancelable, ensure, makeCancelable, spawn } from "@/wab/shared/common";
import { Dropdown, Menu, MenuRef } from "antd";
import Downshift, {
  ControllerStateAndHelpers,
  DownshiftState,
  StateChangeOptions,
} from "downshift";
import $ from "jquery";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import L, * as _ from "lodash";
import * as React from "react";

export interface AutoCompleteSource<T> {
  query: (
    query: string,
    cursorPosition?: number,
    number?: number,
  ) => Promise<T[]>;
  render: (item: T) => any;
}

export type SelectMethod =
  "Enter" | "Tab" | "Click" | "ArrowLeft" | "ArrowRight";
export interface SelectModifiers {
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
}

export interface AutoCompleteSelectProps<T> {
  item: T;
  source: AutoCompleteSource<T>;
  selector: SelectMethod;
  modifiers: SelectModifiers;
  cursorPosition?: number;
}

export const SHOW_MORE = "Show more...";

export const initialLimit = 100;

export interface AutoCompleteProps<P = any> {
  // Starting value.  If you only specify this and not `value`, then the
  // value of the input content is owned by this component.
  defaultValue?: string;

  // Input value.  If you specify this, then this component is "controlled",
  // and the input value must be passed down by the parent (you can listen for
  // changes to input by specifying onChange).
  value?: string;

  // an AutoCompleteSource that supplies the autocomplete options given
  // the query string in the input.
  source: AutoCompleteSource<P>;

  // an input-like Component, like antd's Input or TextArea.  This is the
  // component that the user will be typing into.
  children: React.ReactElement<any>;

  // Converts an autocomplete option to unique key string, used for React key.
  // If not specified, then JSON.stringify() is used.
  itemToString?: (item: P | null) => string;

  // Called whenever the text content in the input is changed
  onChange?: (changes: StateChangeOptions<P>) => void;

  // Called whenever the user selects an autocomplete option.
  onSelect?: (props: AutoCompleteSelectProps<P>) => void;

  // Whether the autocomplete menu is open by default.
  defaultIsOpen?: boolean;

  // Whether the autocomplete menu is always open while it is mounted
  alwaysOpen?: boolean;

  // If true, then left or right arrows will also select the highlighted option
  arrowSubmits?: boolean;

  openOnFocus?: boolean;

  openOnClick?: boolean;

  selectedItem?: P | null;

  // Ant automatically adjust the position of the menu, similar to
  // jquery.position. This is to disable it.
  disableAutoAdjustment?: boolean;

  className?: string;

  downshiftReducer?: (
    state: DownshiftState<P>,
    changes: StateChangeOptions<P>,
  ) => Partial<StateChangeOptions<P>>;

  // If not empty, it specifies the class name of the ancestor that may the
  // content of the dropdown. Then the dropdown need to make it scrollable while
  // not extend the clipping area.
  scrollClipperAncestors?: string[];
}

interface AutoCompleteQueryState<P> {
  readonly source: AutoCompleteSource<P> | undefined;
  readonly items: readonly P[];
}

class AutoCompleteQueries<P> {
  private current: AutoCompleteQueryState<P> = Object.freeze({ source: undefined, items: Object.freeze([]) });
  private pending: Cancelable<P[]> | undefined;
  private queried = false;
  private readonly listeners = new Set<() => void>();
  read = () => this.current;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  hasQueried() { return this.queried; }
  private publish(next: AutoCompleteQueryState<P>) {
    this.current = Object.freeze(next);
    this.listeners.forEach((listener) => listener());
  }
  clear() { this.publish({ ...this.current, items: Object.freeze([]) }); }
  query(source: AutoCompleteSource<P>, text: string, limit: number) {
    this.pending?.cancel();
    const pending = makeCancelable(Promise.resolve().then(() => source.query(text, undefined, limit)));
    this.pending = pending;
    spawn(pending.promise.then((items) => {
      if (this.pending !== pending) { return; }
      this.pending = undefined;
      this.queried = true;
      this.publish({ source, items: Object.freeze([...items]) });
    }, (error) => {
      if (this.pending !== pending) { return; }
      this.pending = undefined;
      throw error;
    }));
    return () => {
      if (this.pending === pending) { this.pending = undefined; pending.cancel(); }
    };
  }
}

function OverlayMenu(props: {
  selectedKeys: string[];
  scrollClipperAncestors?: string[];
  children: React.ReactNode;
}) {
  const menuContainer = React.useRef<MenuRef | null>(null);
  const [height, setHeight] = React.useState<number>();
  React.useLayoutEffect(() => {
    const menu = menuContainer.current?.menu?.list;
    if (!menu || !props.scrollClipperAncestors?.length) { setHeight(undefined); return; }
    const top = menu.getBoundingClientRect().top;
    let bottom = top + menu.scrollHeight;
    const $menu = $(menu);
    props.scrollClipperAncestors.forEach((selector) => {
      const ancestor = $menu.parents(selector).get(0);
      if (ancestor) { bottom = Math.min(bottom, ancestor.getBoundingClientRect().bottom - 8); }
    });
    setHeight(Math.max(0, bottom - top));
  }, [props.children, props.scrollClipperAncestors]);
  return <Scrollbar scrollX={false} defer={false} style={{ height, maxHeight: "30vh", minHeight: 0, overflow: "hidden" }}>
    <Menu prefixCls="ant-dropdown-menu" ref={menuContainer} selectedKeys={props.selectedKeys}>
      {props.children}
    </Menu>
  </Scrollbar>;
}

/** Owns asynchronous options; Downshift owns input and menu interactions. */
export function BetterAutoComplete<P>(props: AutoCompleteProps<P>) {
  const [queries] = React.useState(() => new AutoCompleteQueries<P>());
  const result = React.useSyncExternalStore(queries.subscribe, queries.read, queries.read);
  const [text, setText] = React.useState(props.defaultValue ?? "");
  const [isOpen, setIsOpen] = React.useState(!!(props.defaultIsOpen || props.alwaysOpen));
  const [limit, setLimit] = React.useState(initialLimit);
  const [refresh, setRefresh] = React.useState(0);
  const queryText = _.has(props, "value") ? props.value ?? "" : text;
  const readProps = useCommittedValue(props);
  React.useEffect(() => {
    if (isOpen || !queries.hasQueried()) { return queries.query(props.source, queryText, limit); }
    return undefined;
  }, [queries, props.source, queryText, limit, isOpen, refresh]);
  const itemKey = (item: P | null): string => {
    if (props.itemToString) { return props.itemToString(item); }
    if (_.isObject(item) && "uid" in item) { return `${item["uid"]}`; }
    return _.isObject(item) ? JSON.stringify(item) : `${item}`;
  };
  const select = (item: P | null) => {
    const current = readProps();
    if (current.source !== result.source || queries.read() !== result) { return; }
    if (item != null) { current.onSelect?.({ item, source: current.source, selector: "Click", modifiers: {}, cursorPosition: undefined }); }
    queries.clear();
    // Selecting the same value still refreshes an open query.
    setRefresh((value) => value + 1);
  };
  return <Downshift<P>
    inputValue={props.value} initialInputValue={props.defaultValue}
    onChange={select} itemToString={itemKey}
    defaultHighlightedIndex={0}
    defaultIsOpen={props.defaultIsOpen || props.alwaysOpen}
    stateReducer={props.downshiftReducer}
    selectedItem={props.selectedItem}
    onStateChange={(changes) => {
      if (changes.isOpen !== undefined) {
        setIsOpen(changes.isOpen);
        if (!changes.isOpen) { setLimit(initialLimit); }
      }
      if (changes.inputValue !== undefined && !_.has(props, "value")) { setText(changes.inputValue || ""); }
      props.onChange?.(changes);
    }}>
    {(downshift) => <div {...downshift.getRootProps()} className={props.className}>
      <AutoCompleteContent props={props} downshift={downshift} result={result} itemKey={itemKey} showMore={() => setLimit((value) => value * 2)} />
    </div>}
  </Downshift>;
}

function AutoCompleteContent<P>({ props, downshift, result, itemKey, showMore }: {
  props: AutoCompleteProps<P>;
  downshift: ControllerStateAndHelpers<P>;
  result: AutoCompleteQueryState<P>;
  itemKey: (item: P | null) => string;
  showMore: () => void;
}) {
  const { items, source } = result;
  const currentItem = items.length > 0 && downshift.highlightedIndex != null ? items[downshift.highlightedIndex] : undefined;
  const selectedKey = currentItem == null ? "" : itemKey(currentItem);
  return <Dropdown open={downshift.isOpen && items.length > 0}
      onOpenChange={(open) => open ? downshift.openMenu() : downshift.closeMenu()}
      trigger={props.openOnClick ? ["click"] : []}
      align={props.disableAutoAdjustment ? { overflow: { adjustX: false, adjustY: false } } : undefined}
      popupRender={() => <OverlayMenu selectedKeys={[selectedKey]} scrollClipperAncestors={props.scrollClipperAncestors}>
        {items.map((item, index) => {
          const key = itemKey(item);
          const itemProps = downshift.getItemProps({ item, index });
          return <Menu.Item key={key} {...itemProps}
            className={key === selectedKey ? sty.item__active : itemProps.className}
            {...(L.isString(item) && item === SHOW_MORE ? { onClick: (event: { domEvent: { stopPropagation: () => void } }) => { showMore(); event.domEvent.stopPropagation(); } } : {})}>
            {ensure(source, "Autocomplete options require their source").render(item)}
          </Menu.Item>;
        })}
      </OverlayMenu>}>
      <div><AutoCompleteInput props={props} downshift={downshift} /></div>
    </Dropdown>;
}

function AutoCompleteInput<P>({ props, downshift }: { props: AutoCompleteProps<P>; downshift: ControllerStateAndHelpers<P> }) {
  const input = props.children;
  const Input = input.type;
  const inputProps = downshift.getInputProps({
    ...input.props,
    onChange: (event) => callEventHandlers(event, [input.props.onChange]),
    onFocus: (event) => callEventHandlers(event, [() => { if (props.openOnFocus) { downshift.openMenu(); } }, input.props.onFocus]),
    onKeyDown: (event) => callEventHandlers(event, [input.props.onKeyDown]),
  });
  return <Input {...inputProps} key={input.key} />;
}
