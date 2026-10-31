'use strict';

var Ant = require('antd');
var en_US = require('antd/es/locale/en_US');
var zh_CN = require('antd/es/locale/zh_CN');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n.default = e;
	return Object.freeze(n);
}

var Ant__namespace = /*#__PURE__*/_interopNamespace(Ant);
var en_US__default = /*#__PURE__*/_interopDefault(en_US);
var zh_CN__default = /*#__PURE__*/_interopDefault(zh_CN);



exports.nativeAntd6 = Ant__namespace;
Object.defineProperty(exports, "nativeAntd6EnUS", {
	enumerable: true,
	get: function () { return en_US__default.default; }
});
Object.defineProperty(exports, "nativeAntd6ZhCN", {
	enumerable: true,
	get: function () { return zh_CN__default.default; }
});
//# sourceMappingURL=native.cjs.js.map
