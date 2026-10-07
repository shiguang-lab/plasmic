import { Tooltip } from "antd";
import cls from "classnames";
import React from "react";
import {
  CanvasOverlayProps,
  previewOpenProp,
  useCanvasOverlay,
} from "./canvas-overlay";
import { Registerable, registerComponentHelper } from "./utils";

const canvasOverlay = { triggerSlot: "children" };

function useOverflowContent(enabled: boolean, children: React.ReactNode) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [content, setContent] = React.useState({
    overflowing: false,
    text: "",
  });
  React.useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) {
      return;
    }
    const measure = () => {
      // A template may already own its overflow Tooltip. Avoid two popups.
      const overflowing =
        !element.querySelector("[data-plasmic-overflow-tooltip]") &&
        [
          element,
          ...Array.from(element.querySelectorAll<HTMLElement>("*")),
        ].some(
          (node) =>
            node.clientWidth > 0 &&
            (node.scrollWidth > node.clientWidth + 1 ||
              node.scrollHeight > node.clientHeight + 1),
        );
      const text = element.textContent ?? "";
      setContent((previous) =>
        previous.overflowing === overflowing && previous.text === text
          ? previous
          : { overflowing, text },
      );
    };
    measure();
    const view = element.ownerDocument.defaultView;
    const resize = view?.ResizeObserver && new view.ResizeObserver(measure);
    resize?.observe(element);
    const mutations =
      view?.MutationObserver && new view.MutationObserver(measure);
    mutations?.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    element.ownerDocument.fonts?.addEventListener("loadingdone", measure);
    return () => {
      resize?.disconnect();
      mutations?.disconnect();
      element.ownerDocument.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [enabled, children]);
  return { ref, ...content };
}

export function AntdTooltip(
  props: React.ComponentProps<typeof Tooltip> &
    CanvasOverlayProps & {
      titleText?: string;
      popupRootClassName?: string;
      onlyWhenOverflow?: boolean;
    },
) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const {
    popupRootClassName,
    titleText,
    classNames,
    onlyWhenOverflow,
    children,
    ...rest
  } = canvasProps;
  const overflow = useOverflowContent(!!onlyWhenOverflow, children);
  const title =
    props.title === undefined ? (titleText ?? overflow.text) : props.title;
  const showContent =
    !onlyWhenOverflow || overflow.overflowing || (isEditing && open);
  return (
    <Tooltip
      {...rest}
      trigger={
        props.trigger ?? (onlyWhenOverflow ? ["hover", "focus"] : undefined)
      }
      open={showContent ? open : false}
      destroyOnHidden={isEditing ? true : props.destroyOnHidden}
      onOpenChange={isEditing ? undefined : props.onOpenChange}
      afterOpenChange={isEditing ? undefined : props.afterOpenChange}
      classNames={(info) => {
        const names =
          typeof classNames === "function" ? classNames(info) : classNames;
        return { ...names, root: cls(names?.root, popupRootClassName) };
      }}
      title={showContent ? title : null}
    >
      {onlyWhenOverflow ? (
        <span
          ref={overflow.ref}
          data-plasmic-overflow-tooltip
          tabIndex={overflow.overflowing ? 0 : undefined}
          style={{
            display: "block",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </Tooltip>
  );
}

export function registerTooltip(loader?: Registerable) {
  registerComponentHelper(loader, AntdTooltip, {
    name: "plasmic-antd6-tooltip",
    canvasOverlay,
    displayName: "Tooltip",
    isAttachment: true,
    props: {
      previewOpen: previewOpenProp,
      onlyWhenOverflow: {
        type: "boolean",
        displayName: "Only when overflowing",
        description:
          "Truncate content to one line and show a Tooltip only when it overflows. Selecting Tooltip content still reveals it for editing.",
        defaultValueHint: false,
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "This text element is wrapped in a Tooltip component",
        },
        mergeWithParent: true,
      } as any,
      popupRootClassName: {
        type: "class",
        displayName: "Overlay",
      },
      titleText: {
        type: "string",
        displayName: "Tooltip contents",
        description: "What gets shown inside the tooltip on hover",
        defaultValue: "Tooltip contents",
      },
      trigger: {
        type: "choice",
        options: ["hover", "focus", "click", "contextMenu"],
        multiSelect: true,
        description: "Interactions that reveal the Tooltip.",
        defaultValueHint: ["hover"],
      },
      title: {
        type: "slot",
        displayName: "Tooltip contents",
        hidePlaceholder: true,
      },
      color: {
        type: "color",
        description: "Tooltip fill color",
      },
      placement: {
        type: "choice",
        options: [
          "topLeft",
          "top",
          "topRight",
          "leftTop",
          "left",
          "leftBottom",
          "rightTop",
          "right",
          "rightBottom",
          "bottomLeft",
          "bottom",
          "bottomRight",
        ],
        description: "Default placement of tooltip",
        defaultValueHint: "top",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTooltip",
    importName: "AntdTooltip",
  });
}
