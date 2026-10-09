'use strict';

var plasmicOverseas = require('@shiguang-lab/plasmic-overseas');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');
require('antd');

function registerAppShell(loader) {
  utils.registerComponentHelper(loader, plasmicOverseas.AppShell, { ...plasmicOverseas.appShellMeta, name: "plasmic-antd6-app-shell", importPath: "@shiguang-lab/plasmic-antd6/skinny/registerAppShell" });
}

Object.defineProperty(exports, "AppShell", {
  enumerable: true,
  get: function () { return plasmicOverseas.AppShell; }
});
exports.registerAppShell = registerAppShell;
//# sourceMappingURL=registerAppShell.cjs.js.map
