'use strict';

var plasmicOverseas = require('@shiguang-lab/plasmic-overseas');
var utils = require('./utils-B1jTF3MA.cjs.js');
require('react/jsx-runtime');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');
require('react');
require('@shiguang-lab/plasmic-antd6/thumbnails');
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
