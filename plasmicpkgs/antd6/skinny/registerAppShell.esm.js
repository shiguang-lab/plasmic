import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { AppShell, appShellMeta } from "@shiguang-lab/plasmic-overseas";
import "antd";
import "react";
import { r as registerComponentHelper } from "./utils-CSvRw6Za.esm.js";
export { AppShell } from "@shiguang-lab/plasmic-overseas";

function registerAppShell(loader) {
  registerComponentHelper(loader, AppShell, {
    ...appShellMeta,
    name: "plasmic-antd6-app-shell",
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAppShell",
  });
}

export { registerAppShell };
//# sourceMappingURL=registerAppShell.esm.js.map
