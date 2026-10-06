import { PlasmicCanvasHost } from "@plasmicapp/host";
import * as Antd6 from "antd";
import localeEnUS from "antd/es/locale/en_US";
import localeZhCN from "antd/es/locale/zh_CN";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { StudioControlsProvider } from "./studio-controls-provider";

// Host registrations and canvas packages must share theme contexts and styles.
(window as any).__Sub.StudioControlsProvider = StudioControlsProvider;
(window as any).__Sub.Antd6 = { ...Antd6, localeZhCN, localeEnUS };

export function renderHostScaffold() {
  const appRoot = document.querySelector(".app-root");
  if (appRoot) {
    const root = createRoot(appRoot);
    return root.render(<PlasmicCanvasHost />);
  }
}

if (location.pathname === "/static/host.html") {
  renderHostScaffold();
}
