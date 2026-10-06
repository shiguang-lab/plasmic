import { appShellMeta, AppShell } from '@shiguang-lab/plasmic-overseas';
export { AppShell } from '@shiguang-lab/plasmic-overseas';
import { r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';
import 'react';
import 'antd';

function registerAppShell(loader) {
  registerComponentHelper(loader, AppShell, { ...appShellMeta, name: "plasmic-antd6-app-shell", importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAppShell" });
}

export { registerAppShell };
//# sourceMappingURL=registerAppShell.esm.js.map
