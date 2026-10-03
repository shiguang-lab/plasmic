import { AppShell, appShellMeta } from "@shiguang-lab/plasmic-overseas";
export { AppShell } from "@shiguang-lab/plasmic-overseas";
import { Registerable, registerComponentHelper } from "./utils";
// Published hostless contracts cannot remove components. Keep this hidden name
// for existing saved revisions; new instances are registered by Overseas.
export function registerAppShell(loader?: Registerable) {
  registerComponentHelper(loader, AppShell, { ...appShellMeta, name: "plasmic-antd6-app-shell", importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAppShell" });
}
