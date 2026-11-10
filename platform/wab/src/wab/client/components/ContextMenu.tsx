import { AntdConfigProvider } from "@/wab/client/antd-theme";
import styles from "@/wab/client/components/ContextMenu.module.scss";
import { plasmicIFrameWheelEvent } from "@/wab/client/definitions/events";
import { hasAncestorElement } from "@/wab/client/dom-utils";
import { ensure } from "@/wab/shared/common";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { Dropdown } from "antd";
import { MenuProps } from "antd/lib/menu";
import L from "lodash";
import * as React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";

export type MenuType = React.ReactElement | (() => React.ReactElement);

let contextMenuHandled = false;

export function isContextMenuOpen() {
  return contextMenuHandled;
}

/**
 * Generally try to use WithContextMenu when possible since it reliably cleans
 * up on owner unmount.
 */
export function maybeShowContextMenu(
  event: MouseEvent,
  menu: MenuType | null | undefined,
  opts?: {
    pageX?: number;
    pageY?: number;
  },
) {
  opts = opts || {};
  // Based on antd's Modal.confirm() function
  event.preventDefault();
  event.stopPropagation();

  if (!menu || contextMenuHandled) {
    return;
  }

  contextMenuHandled = true;

  const div = document.createElement("div");
  div.style.zIndex = "1";
  document.body.appendChild(div);
  const root = createRoot(div);
  let destroyed = false;

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    contextMenuHandled = false;
    root.unmount();
    div.remove();
  }

  root.render(
    <AntdConfigProvider>
      <ContextMenu
        overlay={menu}
        pageX={opts.pageX || event.pageX}
        pageY={opts.pageY || event.pageY}
        onHide={destroy}
      />
    </AntdConfigProvider>,
  );

  return { destroy };
}

export function useContextMenu(opts: { menu: MenuType | null | undefined }) {
  const { menu } = opts;
  const destroyRef = React.useRef<(() => void) | undefined>(undefined);
  React.useEffect(() => {
    return () => {
      destroyRef.current && destroyRef.current();
    };
  }, [destroyRef]);
  return {
    onContextMenu: (e: React.MouseEvent) => {
      const result = maybeShowContextMenu(e.nativeEvent, menu);
      if (result) {
        destroyRef.current = result.destroy;
      }
    },
  } as const;
}

// Loosely modeled after https://github.com/vkbansal/react-contextmenu
interface ContextMenuProps {
  overlay: MenuType;
  pageX: number;
  pageY: number;
  onHide: () => void;
}

export default function ContextMenu({ overlay, pageX, pageY, onHide }: ContextMenuProps) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const dismiss = React.useEffectEvent(onHide);
  const content = React.useRef<HTMLDivElement>(null);
  useStudioEscape(content, true, onHide);
  React.useLayoutEffect(() => {
    const portal = document.createElement("div");
    document.body.appendChild(portal);
    setContainer(portal);
    let closeTask: ReturnType<typeof setTimeout> | undefined;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (content.current?.contains(target) && !target.closest("button,[role=menuitem]")) { return; }
      if (closeTask !== undefined) { clearTimeout(closeTask); }
      // Let the selected item's action run before dismissing its portal.
      closeTask = setTimeout(() => dismiss(), 0);
    };
    const onWheel = (event: Event) => {
      const outside = event.type === plasmicIFrameWheelEvent ||
        (event.target instanceof HTMLElement && !hasAncestorElement(event.target, (element) => element.className.includes("ant-dropdown")));
      if (outside && !event.cancelBubble) { dismiss(); }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("wheel", onWheel);
    document.addEventListener(plasmicIFrameWheelEvent, onWheel);
    return () => {
      if (closeTask !== undefined) { clearTimeout(closeTask); }
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener(plasmicIFrameWheelEvent, onWheel);
      portal.remove();
    };
  }, []);
  if (!container) { return null; }
  return createPortal(
    <Dropdown open={true} onOpenChange={(visible) => { if (!visible) { onHide(); } }}
      popupRender={() => <div ref={content}>{typeof overlay === "function" ? overlay() : overlay}</div>} trigger={["click"]}>
      <div className={styles.ContextMenu} style={{ left: `${pageX}px`, top: `${pageY}px` }} />
    </Dropdown>,
    container,
  );
}

interface WithContextMenuProps {
  overlay?:
    React.ReactElement<MenuProps> | (() => React.ReactElement<MenuProps>);
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
  onClick?: (e: React.MouseEvent) => void;
}
/** Owns the context menu for this mounted trigger. */
export function WithContextMenu({ overlay, children, as, ...rest }: WithContextMenuProps) {
  const [position, setPosition] = React.useState<{ pageX: number; pageY: number }>();
  const hide = React.useCallback(() => setPosition(undefined), []);
  const createMenu = () => {
    const value = ensure(overlay, "Only called if overlay exists");
    const menu = L.isFunction(value) ? value() : value;
    return React.cloneElement(menu, {
      onClick: (param) => {
        menu.props.onClick?.(param);
        hide();
      },
    });
  };
  const Element = as || "div";
  if (!overlay) { return <Element {...rest}>{children}</Element>; }
  return <Element {...rest} onContextMenu={(event: React.MouseEvent) => {
    event.preventDefault();
    setPosition({ pageX: event.pageX, pageY: event.pageY });
  }}>
    {children}
    {position && <ContextMenu {...position} overlay={createMenu} onHide={hide} />}
  </Element>;
}
