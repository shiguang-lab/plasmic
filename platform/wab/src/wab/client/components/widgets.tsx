import { reportError } from "@/wab/client/ErrorNotifications";
import { PublicLink } from "@/wab/client/components/PublicLink";
import { useEditorPopupStyles } from "@/wab/client/components/ui/layout-styles";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { Textbox, TextboxRef } from "@/wab/client/components/widgets/Textbox";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import {
  useFocusOnDisplayed,
  useToggleDisplayed,
} from "@/wab/client/dom-utils";
import { useFileDragState } from "@/wab/client/file-drag/useFileDragState";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { VERT_MENU_ICON } from "@/wab/client/icons";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import EyeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Eye";
import EyeClosedIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__EyeClosed";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import SearchIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Search";
import TrashIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Trash";
import DragGripIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__DragGrip";
import UploadSvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__UploadSvg";
import { usesProductTheme } from "@/wab/client/ui-theme";
import {
  MaybeWrap,
  createFakeEvent,
  swallowClick,
  useReadablePromise,
  useCommittedValue,
} from "@/wab/commons/components/ReactUtil";
import {
  XDraggable,
  XDraggableEventHandler,
} from "@/wab/commons/components/XDraggable";
import { ReadablePromise } from "@/wab/commons/control";
import {
  cx,
  ensure,
  isCurrentlyWithinPath,
  makeCancelable,
  maybe,
} from "@/wab/shared/common";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import type { DropdownProps } from "antd";
import { Dropdown, Skeleton, Table, Tooltip } from "antd";
import classNames from "classnames";
import { isKeyHotkey } from "is-hotkey";
import L from "lodash";
import * as React from "react";
import { CSSProperties, ReactElement, ReactNode } from "react";
import {
  DragDropContext,
  Draggable,
  DropResult,
  Droppable,
} from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import { FaUpload } from "react-icons/fa";

export function LinkButton(props: React.ComponentProps<"button">) {
  const { className, ...rest } = props;
  return <button className={cx("link-like", className)} {...rest} />;
}
export interface PlainLinkButtonProps extends React.ComponentProps<"button"> {
  "data-test-id"?: string;
  tooltip?: React.ReactNode;
}
// Forwards its ref to the button so antd Tooltip/Popover/Dropdown can anchor
// on it when it is their direct child.
export const PlainLinkButton = React.forwardRef<
  HTMLButtonElement,
  PlainLinkButtonProps
>(function PlainLinkButton(props, ref) {
  const { disabled, onClick, className, tooltip, ...forwardedProps } = props;
  return (
    <MaybeWrap
      cond={!!tooltip}
      wrapper={(x) => (
        <Tooltip title={tooltip}>
          <TriggerTarget>{x}</TriggerTarget>
        </Tooltip>
      )}
    >
      <button
        {...forwardedProps}
        ref={ref}
        aria-label={
          props["aria-label"] ??
          (typeof tooltip === "string" ? tooltip : undefined)
        }
        className={cx(
          {
            "non-link-btn": true,
            "non-link-btn--disabled": disabled,
          },
          className,
        )}
        onClick={disabled ? undefined : onClick}
        tabIndex={disabled ? -1 : 0}
        disabled={disabled}
      />
    </MaybeWrap>
  );
});

export function PlainLink(
  props: React.ComponentProps<"a"> & {
    disabled?: boolean;
    activeClassName?: string;
  },
) {
  const { href, className, activeClassName, disabled, ...forwardedProps } =
    props;
  return (
    <PublicLink
      {...forwardedProps}
      className={cx(
        {
          "plain-link": true,
          "plain-link--disabled": disabled,
        },
        className,
        href && isCurrentlyWithinPath(href) ? activeClassName : undefined,
      )}
      tabIndex={disabled ? -1 : 0}
      href={href}
    />
  );
}

export const IconLinkButton = React.forwardRef<
  HTMLButtonElement,
  PlainLinkButtonProps
>(function IconLinkButton(props, ref) {
  return (
    <PlainLinkButton
      {...props}
      ref={ref}
      className={`icon-link-btn ${props.className}`}
    />
  );
});

type ModalProps = {
  className?: string;
  children: ReactNode;
};
export function Modal({ className, children }: ModalProps) {
  return <div className={cx("modal", className)}>{children}</div>;
}
export function Spinner() {
  return <div className="loader-container"><div className="loader"><UiText message="Loading..." /></div></div>;
}
type LoadableProps<T> = {
  loader: () => Promise<T>;
  contents: (data: T) => ReactNode;
  loadingContents?: () => ReactNode;
  failureContents?: (retry: () => void, error: unknown) => ReactNode;
};
type LoadableState<T> =
  | { state: "loading" }
  | { state: "loaded"; data: T }
  | { state: "failed"; error: unknown };

export function Loadable<T>(props: LoadableProps<T>) {
  const readLoader = useCommittedValue(props.loader);
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<LoadableState<T>>({ state: "loading" });
  React.useEffect(() => {
    let active = true;
    const pending = makeCancelable(Promise.resolve().then(() => readLoader()()));
    void pending.promise.then(
      (data) => { if (active) { setResult({ state: "loaded", data }); } },
      (error) => {
        if (!active) { return; }
        setResult({ state: "failed", error });
        reportError(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => { active = false; pending.cancel(); };
  }, [attempt, readLoader]);
  const retry = () => { setResult({ state: "loading" }); setAttempt((value) => value + 1); };
  if (result.state === "loaded") { return props.contents(ensure(result.data, "Data state not defined in Loadable component")); }
  if (result.state === "failed") {
    return props.failureContents ? props.failureContents(retry, result.error) : <LoadingError onRetry={retry} />;
  }
  return props.loadingContents ? props.loadingContents() : <Spinner />;
}

export function ReadablePromiseLoadable<T, E>({
  rp,
  contents,
  failureContents = () => null,
  loadingContents: _loadingContentsInput,
}: {
  rp: ReadablePromise<T, E>;
  loadingContents?: () => ReactElement | null;
  contents: (x: T) => ReactElement | null;
  failureContents?: (x: E) => ReactElement | null;
}) {
  const loadingContents = _loadingContentsInput === undefined ? (() => <Spinner />) : _loadingContentsInput;
  const result = useReadablePromise(rp);
  if (!result) {
    return loadingContents();
  }
  return result.match(contents, failureContents);
}


export class Tab {
  name: ReactNode;
  contents: () => any;
  key: string;
  pullRight?: boolean;
  constructor(args: Tab) {
    Object.assign(this, L.pick(args, "name", "contents", "key", "pullRight"));
  }
}
type TabsProps = {
  tabs: Tab[];
  tabBarClassName?: string;
  className?: string;
  tabKey?: any;
  defaultTabKey?: any;
  onSwitch?: (...args: any[]) => any;
  tabClassName?: any;
  activeTabClassName?: any;
  useDefaultClasses?: boolean;
  barWrapper?: (bar: React.ReactNode) => any;
  contentWrapper?: (...args: any[]) => any;
  scrollByTransform?: boolean;
  forceRender?: boolean;
  tabBarExtraContent?: React.ReactNode;
};
export function Tabs(props: TabsProps) {
  const [uncontrolledKey, setUncontrolledKey] = React.useState(props.defaultTabKey ?? 0);
  const tabKey = props.tabKey === undefined ? uncontrolledKey : props.tabKey ?? 0;
  const { barWrapper = L.identity, contentWrapper = L.identity, useDefaultClasses = true } = props;
    return (
      <div className={cx("tabs", props.className)}>
        {barWrapper(
          <div
            className={cx("nav-tabs", props.tabBarClassName)}
            role="tablist"
          >
            <div>
              {props.tabs.map((tab: /*TWZ*/ Tab, i: /*TWZ*/ number) => {
                const key = tab.key != null ? tab.key : i;
                const isActive = tabKey === key;
                return (
                  <button
                    key={key}
                    className={cx(
                      {
                        "nav-tab": true && useDefaultClasses,
                        "nav-tab--active":
                          isActive && useDefaultClasses,
                        "nav-tab--pull-right":
                          props.tabs.length > 1 && tab.pullRight,
                      },
                      props.tabClassName,
                      tabKey === key
                        ? props.activeTabClassName
                        : undefined,
                    )}
                    id={`nav-tab-${key}`}
                    onClick={() => {
                      if (props.tabKey === undefined) { setUncontrolledKey(key); }
                      props.onSwitch?.(key);
                    }}
                    data-test-tabkey={key}
                    tabIndex={0}
                    aria-selected={isActive}
                    role="tab"
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>
            {props.tabBarExtraContent}
          </div>,
        )}

        <div
          className={"tab-content"}
          style={props.scrollByTransform ? { overflow: "hidden" } : {}}
        >
          {props.tabs.map((tab, i) => {
            const isSelected = tabKey === (tab.key ?? i);
            if (!isSelected && !props.forceRender) {
              return null;
            }
            return (
              <div
                className="vlist-scrollable-descendant"
                key={tab.key ?? i}
                style={{
                  display: isSelected ? "flex" : "none",
                }}
              >
                {contentWrapper(tab.contents())}
              </div>
            );
          })}
        </div>
      </div>
    );
}

interface DragItemProps {
  dragHandle: () => ReactNode;
  onDragStart?: XDraggableEventHandler;
  onDrag?: XDraggableEventHandler;
  onDragEnd?: XDraggableEventHandler;
  children: ReactNode;
  minPx?: number;
}

export function DragItem({
  onDragStart = () => {},
  onDrag = () => {},
  onDragEnd = () => {},
  children,
  dragHandle,
  minPx,
}: DragItemProps) {
  return (
    <XDraggable
      minPx={minPx}
      onStart={onDragStart}
      onDrag={onDrag}
      onStop={onDragEnd}
      render={(e) => (
        <div className={"pass-through no-select"}>
          {e &&
            e.data.started &&
            createPortal(
              <div
                className={"DragItem__Handle"}
                style={{
                  left: e.mouseEvent.pageX,
                  top: e.mouseEvent.pageY,
                }}
              >
                {dragHandle()}
              </div>,
              document.body,
            )}
          {children}
        </div>
      )}
    />
  );
}

const fileUploaderAcceptConfig = {
  any: { inputAccept: undefined, dropText: "Drop file to upload" },
  image: {
    inputAccept: ".gif,.jpg,.jpeg,.png,.avif,.tif,.svg,.webp,.ico",
    dropText: "Drop image to upload",
  },
  svg: { inputAccept: ".svg", dropText: "Drop SVG to upload" },
} as const;

export type FileUploaderAccept = keyof typeof fileUploaderAcceptConfig;

export interface FileUploaderProps {
  onChange: (files: FileList | null) => void;
  accept: FileUploaderAccept;
  style?: React.CSSProperties;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function FileUploader(props: FileUploaderProps) {
  const { t: uiT } = useI18n();
  const { onChange, accept, style, children, disabled } = props;
  const { inputAccept, dropText } = fileUploaderAcceptConfig[accept];
  const [input, setInput] = React.useState<HTMLInputElement | null>(null);
  const dragState = useFileDragState(input);
  return (
    <Tooltip title={uiT("Upload or drag a file here")}>
      <PlainLinkButton className="file-uploader" style={style}>
        {children ?? (
          <div className={"fake-upload"}>
            <FaUpload />
          </div>
        )}
        {dragState && !disabled && (
          <div
            className={cx("drop-overlay", "file-uploader__drop-overlay", {
              "drop-overlay--dragover": dragState === "draggingOver",
            })}
          >
            <Icon icon={UploadSvgIcon} size={24} />
            <span>{uiT(dropText)}</span>
          </div>
        )}
        <input
          ref={setInput}
          type="file"
          className={"opaque-file-uploader"}
          onChange={(e) => onChange(e.target.files)}
          accept={inputAccept}
          disabled={disabled}
        />
      </PlainLinkButton>
    </Tooltip>
  );
}

export interface FileUploadLinkProps {
  onChange: (files: FileList | null) => void;
  accept?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FileUploadLink(props: FileUploadLinkProps) {
  const { onChange, accept, style, children, className } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <PlainLinkButton
      className={cx("link-like", className)}
      style={style}
      onClick={() => {
        inputRef.current?.click();
      }}
    >
      {children}
      <input
        type="file"
        className={"display-none"}
        onChange={(e) => onChange(e.target.files)}
        accept={accept}
        ref={inputRef}
      />
    </PlainLinkButton>
  );
}

/**
 * Either addHoverContent or onAdd or addMenu must bes specified.
 */
interface ListBoxProps {
  addText?: string;
  addNode?: React.ReactNode;
  onAdd?: (...args: any[]) => any;
  addHoverContent?: React.ReactNode;
  appendPrepend?: "append" | "prepend";
  onReorder?: (from: number, to: number) => void;
  addMenu?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  "data-test-id"?: string;
}

export function ListBox(props: ListBoxProps) {
  const [adding, setAdding] = React.useState(false);
  const handleDragEnd = (result: DropResult) => {
    if (result.destination) { props.onReorder?.(result.source.index, result.destination.index); }
  };
    const { addText, addNode, disabled } = props;
    // TODO this is inconsistently firing onmouseleave because the div is
    //  actually getting unmounted and then mounted.  See
    //  https://github.com/facebook/react/issues/6807.
    let addButton = (
      <PlainLinkButton
        className={"list-box__add-placeholder"}
        onClick={props.onAdd}
        type="button"
        disabled={disabled}
        data-test-id={`${props["data-test-id"]}-add-btn`}
      >
        <div>
          {addNode ? (
            addNode
          ) : (
            <>
              <Icon icon={PlusIcon} /> {addText}
            </>
          )}
        </div>
      </PlainLinkButton>
    );
    if (props.addMenu) {
      addButton = (
        <IFrameAwareDropdownMenu menu={props.addMenu}>
          {addButton}
        </IFrameAwareDropdownMenu>
      );
    }
    const adder =
      !addText && !addNode ? null : (
        <div
          onMouseEnter={() => {
            if (props.addHoverContent != null) {
              return setAdding(true);
            }
          }}
          onMouseLeave={() => {
            setAdding(false);
          }}
        >
          {!adding ? (
            addButton
          ) : (
            <div className={"list-box__add-placeholder"}>
              {props.addHoverContent}
            </div>
          )}
        </div>
      );
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        {props.appendPrepend === "prepend" ? adder : undefined}
        <Droppable droppableId={"droppable"}>
          {(provided) => (
            <div ref={provided.innerRef} className={"list-box"}>
              {props.children}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
        {props.appendPrepend === "append" ? adder : undefined}
      </DragDropContext>
    );
}

interface ListBoxItemProps {
  thumbnail?: React.ReactNode;
  mainContent: React.ReactNode;
  /** Triggered on click or on "Enter" key down */
  onClick?: () => void;
  onRemove?: (...args: any[]) => any;
  onToggleHide?: () => void;
  index: number;
  isDragDisabled?: boolean;
  disabled?: boolean;
  isHidden?: boolean;
  alignTop?: boolean;
  className?: string;
  showGrip?: boolean;
  showDelete?: boolean;
  showHide?: boolean;
  clickable?: boolean;
  truncate?: boolean;
  gridThumbnail?: boolean;
  menu?: React.ReactNode | MenuMaker;
  isHighlighted?: boolean;
  "data-test-id"?: string;
}

export function ListBoxItem(props: ListBoxItemProps) {
  const dragId = React.useId();
    const {
      index,
      className,
      isDragDisabled,
      disabled,
      isHidden,
      showGrip = true,
      showDelete = true,
      showHide = false,
      onRemove = () => {},
      onToggleHide = () => {},
      clickable = true,
      truncate = true,
      menu,
    } = props;
    return (
      <Draggable
        draggableId={`${dragId}`}
        index={index}
        isDragDisabled={isDragDisabled}
      >
        {(provided, snapshot) => {
          const child = (
            <>
              <div
                ref={provided.innerRef}
                className={"list-box-item-focusable"}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                // TODO: remove this hack
                // react-beautiful-dnd interface exposes
                // React.DragEventHandler<any>, which results in a type mismatch
                onDragStart={
                  provided.dragHandleProps
                    ?.onDragStart as React.DragEventHandler<HTMLDivElement>
                }
                onKeyDown={(event) => {
                  if (
                    props.onClick &&
                    isKeyHotkey("enter", event.nativeEvent)
                  ) {
                    props.onClick();
                    event.stopPropagation();
                  }
                }}
              >
                <div
                  className={classNames(className, {
                    "list-box-item flex-vcenter": true,
                    "list-box-item--top": !!props.alignTop,
                    "list-box-item--clickable": !!clickable,
                    "list-box-item--highlighted": !!props.isHighlighted,
                    group: true,
                  })}
                  data-test-id={props["data-test-id"]}
                  onClick={props.onClick}
                >
                  {props.thumbnail && (
                    <div
                      className={classNames({
                        "list-box-item__img": true,
                        "list-box-item__img-grid": props.gridThumbnail,
                      })}
                    >
                      {props.thumbnail}
                    </div>
                  )}

                  <div
                    className={classNames({
                      "flex flex-vcenter list-box-item__label": true,
                      "list-box-item__label--truncate": !!truncate,
                    })}
                  >
                    {props.mainContent}
                  </div>

                  {showGrip && (
                    <div
                      className={"list-box-item__handle opaque-on-group-hover"}
                    >
                      <Icon icon={DragGripIcon} />
                    </div>
                  )}

                  {(showDelete || menu) && (
                    <div
                      className="list-box-item__actions"
                      onClick={(e) => swallowClick(e)}
                    >
                      {showDelete && (
                        <button
                          className={"icon-button opaque-on-group-hover"}
                          type="button"
                          onClick={(ev) => {
                            onRemove();
                            return ev.stopPropagation();
                          }}
                          disabled={disabled}
                          data-test-id={
                            props["data-test-id"]
                              ? `${props["data-test-id"]}-remove`
                              : undefined
                          }
                        >
                          <Icon icon={TrashIcon} />
                        </button>
                      )}
                      {menu && (
                        <IFrameAwareDropdownMenu menu={menu}>
                          <div className="list-box-item__action opaque-on-group-hover">
                            {VERT_MENU_ICON}
                          </div>
                        </IFrameAwareDropdownMenu>
                      )}
                    </div>
                  )}

                  {showHide &&
                    (isHidden ? (
                      <button
                        className={"icon-button"}
                        onClick={(ev) => {
                          onToggleHide();
                          ev.stopPropagation();
                        }}
                      >
                        <Icon icon={EyeClosedIcon} />
                      </button>
                    ) : (
                      <button
                        className={"icon-button opaque-on-group-hover"}
                        onClick={(ev) => {
                          onToggleHide();
                          ev.stopPropagation();
                        }}
                      >
                        <Icon icon={EyeIcon} />
                      </button>
                    ))}
                </div>
              </div>
            </>
          );
          if (snapshot.isDragging) {
            return createPortal(child, document.body);
          } else {
            return child;
          }
        }}
      </Draggable>
    );
}

export function InlineIcon({ children }: { children: ReactNode }) {
  return <div className={"InlineIcon"}>{children}</div>;
}

export type MenuMaker = (onMenuClicked: () => void) => React.ReactNode;

/**
 * antd 5 mounts popup content while it is still display:none, so autoFocus and
 * focusing from onOpenChange are no-ops. Render this inside the popup content
 * to focus targetId as soon as the popup is actually displayed.
 */
export function PopupFocuser(props: {
  targetId: string;
  targetRef: React.RefObject<{ focus: () => void } | null>;
}) {
  const { targetId, targetRef } = props;
  useToggleDisplayed(
    React.useCallback(() => document.getElementById(targetId), [targetId]),
    React.useCallback(
      (displayed: boolean) => {
        if (displayed) {
          targetRef.current?.focus();
        }
      },
      [targetRef],
    ),
  );
  return null;
}

export const IFrameAwareDropdownMenu = (props: {
  menu: React.ReactNode | MenuMaker;
  children?: ReactNode;
  disabled?: boolean;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  onVisibleChange?: (visible: boolean) => void;
  placement?: DropdownProps["placement"];
  align?: DropdownProps["align"];
}) => {
  const { onVisibleChange } = props;
  const productUI = usesProductTheme(window.location.pathname);
  const [menuVisible, setMenuVisibleState] = React.useState(false);
  const triggerElement = React.useRef<HTMLElement | null>(null);
  const dropdownTrigger = React.useRef<HTMLElement | null>(null);
  const [menuMaxHeight, setMenuMaxHeight] = React.useState<number>();
  const [popupPoint, targetPoint] = props.align?.points ?? [];
  const sideAligned = popupPoint?.[0] === "t" && targetPoint?.[0] === "t";
  const offsetY = Number(props.align?.offset?.[1] ?? 0);

  React.useLayoutEffect(() => {
    if (!menuVisible || !productUI || !sideAligned) {
      setMenuMaxHeight(undefined);
      return;
    }
    const trigger = dropdownTrigger.current;
    if (!trigger) {
      return;
    }
    const updateHeight = () => {
      const { top, bottom } = trigger.getBoundingClientRect();
      const viewportHeight = trigger.ownerDocument.documentElement.clientHeight;
      // Antd can flip a side-aligned menu to align with the trigger's bottom.
      // Fit the larger side, leaving the trigger as the anchor in either case.
      setMenuMaxHeight(
        Math.max(
          0,
          Math.min(
            viewportHeight * 0.8,
            Math.max(viewportHeight - top - offsetY, bottom + offsetY) - 8,
          ),
        ),
      );
    };
    updateHeight();
    const ownerWindow = trigger.ownerDocument.defaultView;
    ownerWindow?.addEventListener("resize", updateHeight);
    ownerWindow?.addEventListener("scroll", updateHeight, true);
    return () => {
      ownerWindow?.removeEventListener("resize", updateHeight);
      ownerWindow?.removeEventListener("scroll", updateHeight, true);
    };
  }, [menuVisible, productUI, sideAligned, offsetY]);

  const setMenuVisible = React.useCallback(
    (visible: boolean) => {
      if (visible && document.activeElement instanceof HTMLElement) {
        triggerElement.current = document.activeElement;
      }
      setMenuVisibleState(visible);
      if (onVisibleChange) {
        onVisibleChange(visible);
      }
    },
    [setMenuVisibleState, onVisibleChange],
  );

  React.useEffect(() => {
    if (!menuVisible) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setMenuVisible(false);
      triggerElement.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [menuVisible, setMenuVisible]);

  return (
    <Dropdown
      ref={dropdownTrigger}
      disabled={props.disabled}
      placement={props.placement}
      align={
        props.align ?? {
          offset: [0, props.placement?.startsWith("top") ? -8 : 8],
        }
      }
      popupRender={() => {
        const { menu } = props;
        const effectiveMenu = (
          L.isFunction(menu) ? menu(() => setMenuVisible(false)) : menu
        ) as React.ReactElement<import("antd").MenuProps>;
        return (
          <DropdownMenuContent
            menu={effectiveMenu}
            productUI={productUI}
            maxHeight={menuMaxHeight}
            onClose={() => setMenuVisible(false)}
          />
        );
      }}
      trigger={["click"]}
      open={menuVisible}
      onOpenChange={(visible) => setMenuVisible(visible)}
      overlayClassName={props.overlayClassName}
      overlayStyle={props.overlayStyle}
      destroyPopupOnHide
    >
      <TriggerTarget>{props.children}</TriggerTarget>
    </Dropdown>
  );
};

/** Build palette rules and scrolling only when a menu is actually opened. */
function DropdownMenuContent({
  menu: effectiveMenu,
  productUI,
  maxHeight: menuMaxHeight,
  onClose,
}: {
  menu: React.ReactElement<import("antd").MenuProps>;
  productUI: boolean;
  maxHeight?: number;
  onClose: () => void;
}) {
  const { styles: popupStyles } = useEditorPopupStyles();
  const renderScrollableMenu = (menu: ReactNode, maxHeight?: number) =>
    productUI ? (
      <Scrollbar
        scrollX={false}
        defer={false}
        className={cx(
          "studio-scrollbar",
          popupStyles.menuScroll,
          popupStyles.root,
        )}
        style={maxHeight === undefined ? undefined : { maxHeight }}
      >
        {menu}
      </Scrollbar>
    ) : (
      menu
    );

  return renderScrollableMenu(
    React.cloneElement(effectiveMenu, {
      rootClassName: cx(
        effectiveMenu.props.rootClassName,
        productUI && popupStyles.root,
      ),
      popupRender: (node, info) =>
        renderScrollableMenu(
          effectiveMenu.props.popupRender?.(node, info) ?? node,
        ),
      // Include the menu's 8px padding to align rows and leave a 4px gap.
      builtinPlacements: productUI
        ? {
            ...effectiveMenu.props.builtinPlacements,
            rightTop: {
              points: ["tl", "tr"],
              offset: [12, -8],
              overflow: { adjustX: 1, adjustY: 1 },
            },
            leftTop: {
              points: ["tr", "tl"],
              offset: [-12, -8],
              overflow: { adjustX: 1, adjustY: 1 },
            },
          }
        : effectiveMenu.props.builtinPlacements,
      onClick: (e) => {
        onClose();
        if (effectiveMenu.props.onClick) {
          effectiveMenu.props.onClick(e);
        }
        e.domEvent.stopPropagation();
      },
    }),
    menuMaxHeight,
  );
}

export function ClickStopper({
  children,
  passthrough,
  preventDefault,
  style,
  className,
}: {
  children: ReactNode;
  passthrough?: boolean;
  preventDefault?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={
        className +
        (passthrough
          ? " pass-through clicker-stopper"
          : " block clicker-stopper")
      }
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        if (preventDefault) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}

export function SearchBox(
  props: Omit<
    React.ComponentProps<typeof Textbox>,
    "prefixIcon" | "suffixIcon"
  >,
) {
  const ref = React.useRef<TextboxRef>(null);

  const getInput = React.useCallback(
    () => maybe(ref.current, (x) => x.input()),
    [ref],
  );
  useFocusOnDisplayed(getInput, { autoFocus: props.autoFocus });

  const resetInput = (e: React.SyntheticEvent) => {
    if (ref.current) {
      ref.current.setValue("");
      if (props.onChange) {
        // Copied from antd's "antd/lib/input/Input.resolveOnChange"
        // Fakes a ChangeEvent with value ""
        const input = ref.current.input();
        const fakeEvent = createFakeEvent<React.ChangeEvent<HTMLInputElement>>(
          e,
          input,
        );
        const originalInputValue = input.value;
        input.value = "";
        props.onChange && props.onChange(fakeEvent);
        input.value = originalInputValue;
      }
    }
  };
  return (
    <Textbox
      prefixIcon={<Icon icon={SearchIcon} />}
      withIcons={["withPrefix", "withSuffix"]}
      suffixIcon={
        props.value &&
        `${props.value}`.trim().length > 0 && (
          <IconButton type="seamless" onClick={(e) => resetInput(e)}>
            <Icon icon={CloseIcon} />
          </IconButton>
        )
      }
      ref={ref}
      {...props}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          resetInput(e);
        }
      }}
    />
  );
}

/**
 * A version of antd's Table that fills the available vertical space,
 * and sets scroll properly for the table body
 */
export function VerticalFillTable<T extends object>(
  props: React.ComponentProps<typeof Table<T>> & { wrapperClassName?: string },
) {
  const { wrapperClassName, ...rest } = props;
  return (
    <div className={cx("vertical-fill-table", wrapperClassName)}>
      <Table {...rest} />
    </div>
  );
}
