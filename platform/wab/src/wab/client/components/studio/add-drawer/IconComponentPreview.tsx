import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { AddItem, isTplAddItem } from "@/wab/client/definitions/insertables";
import { ensure } from "@/wab/shared/common";
import { isCodeComponent } from "@/wab/shared/core/components";
import { theme } from "antd";
import * as React from "react";
import type { Root } from "react-dom/client";

export function isAntDesignIconItem(item: AddItem) {
  return (
    isTplAddItem(item) &&
    !!item.component &&
    isCodeComponent(item.component) &&
    item.component.codeComponentMeta.importPath === "@ant-design/icons"
  );
}

/** Render with the React instance that loaded the registered implementation. */
export function IconComponentPreview({
  component,
  runtime,
}: {
  component: React.ComponentType<any>;
  runtime: Pick<SubDeps, "React" | "ReactDOMClient">;
}) {
  const container = React.useRef<HTMLSpanElement>(null);
  const root = React.useRef<Root>();
  const { token } = theme.useToken();

  React.useEffect(() => {
    const mount = document.createElement("span");
    ensure(container.current, "Missing icon preview container").appendChild(mount);
    const hostRoot = ensure(
      runtime.ReactDOMClient,
      "Icon previews require the registration's React DOM client",
    ).createRoot(mount);
    root.current = hostRoot;
    return () => {
      root.current = undefined;
      mount.remove();
      // The Host root must unmount outside Studio's React commit. A separate
      // mount also keeps StrictMode's replacement root independent of this one.
      queueMicrotask(() => hostRoot.unmount());
    };
  }, [runtime]);

  React.useEffect(() => {
    ensure(root.current, "Missing Host icon preview root").render(
      runtime.React.createElement(component, {
        style: { fontSize: 24, color: token.colorText },
        twoToneColor: [token.colorText, token.colorPrimaryBgHover],
        "aria-hidden": true,
        tabIndex: -1,
      }),
    );
  }, [runtime, component, token.colorText, token.colorPrimaryBgHover]);

  return (
    <span
      ref={container}
      aria-hidden
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
