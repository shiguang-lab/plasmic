import { ResourceAuthorizationCanvasContext } from "./canvas-context.js";
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
import { Drawer as _Drawer } from "antd";
import { Spin as _Spin } from "antd";
import { Checkbox as _Checkbox } from "antd";
import { Input as _Input } from "antd";
import { Select as _Select } from "antd";
import { Divider as _Divider } from "antd";
import { Descriptions as _Descriptions } from "antd";
import { Space as _Space } from "antd";
import { Button as _Button } from "antd";
import { message as _message } from "antd";
import { Form as _Form } from "antd";
function _regeneratorRuntime() { "use strict"; /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator.return && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, catch: function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
import { useContext, useEffect, useMemo, useState } from 'react';
import { withConfigProvider } from "../config-provider/index.js";
import { createResourceAuthorizationApi } from "./api.js";
import { PolicyCategory } from "./constants.js";
import Record from "./Record.js";
import { useStyles } from "./style.js";
import { flattenDepts, formatUsers, getErrorMessage } from "./utils.js";
import { jsx as _jsx } from "react/jsx-runtime";
import { jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment as _Fragment } from "react/jsx-runtime";
function AuthorizationCom(_ref) {
  var open = _ref.open,
    resourceTypeCode = _ref.resourceTypeCode,
    resourceId = _ref.resourceId,
    resourceName = _ref.resourceName,
    onClose = _ref.onClose,
    onSuccess = _ref.onSuccess,
    apiSources = _ref.apiSources,
    _ref$title = _ref.title,
    title = _ref$title === void 0 ? '新增个性化授权' : _ref$title,
    _ref$width = _ref.width,
    width = _ref$width === void 0 ? 500 : _ref$width;
  var isEditing = useContext(ResourceAuthorizationCanvasContext);
  var _useStyles = useStyles(),
    styles = _useStyles.styles;
  var _Form$useForm = _Form.useForm(),
    _Form$useForm2 = _slicedToArray(_Form$useForm, 1),
    form = _Form$useForm2[0];
  var _message$useMessage = _message.useMessage(),
    _message$useMessage2 = _slicedToArray(_message$useMessage, 2),
    messageApi = _message$useMessage2[0],
    messageContextHolder = _message$useMessage2[1];
  var _useState = useState(false),
    _useState2 = _slicedToArray(_useState, 2),
    loading = _useState2[0],
    setLoading = _useState2[1];
  var _useState3 = useState(false),
    _useState4 = _slicedToArray(_useState3, 2),
    submitting = _useState4[0],
    setSubmitting = _useState4[1];
  var _useState5 = useState([]),
    _useState6 = _slicedToArray(_useState5, 2),
    resourceTypes = _useState6[0],
    setResourceTypes = _useState6[1];
  var _useState7 = useState([]),
    _useState8 = _slicedToArray(_useState7, 2),
    actions = _useState8[0],
    setActions = _useState8[1];
  var _useState9 = useState([]),
    _useState10 = _slicedToArray(_useState9, 2),
    userOptions = _useState10[0],
    setUserOptions = _useState10[1];
  var _useState11 = useState([]),
    _useState12 = _slicedToArray(_useState11, 2),
    deptOptions = _useState12[0],
    setDeptOptions = _useState12[1];
  var _useState13 = useState('USER'),
    _useState14 = _slicedToArray(_useState13, 2),
    bindType = _useState14[0],
    setBindType = _useState14[1];
  var api = useMemo(function () {
    return createResourceAuthorizationApi(apiSources);
  }, [apiSources]);
  useEffect(function () {
    if (!open || isEditing) return;
    setLoading(true);
    api.listResourceTypes().then(setResourceTypes).catch(function () {
      setResourceTypes([]);
    }).finally(function () {
      return setLoading(false);
    });
  }, [api, open, isEditing]);
  useEffect(function () {
    if (!open || !resourceTypeCode || isEditing) return;
    api.getResourceActions(resourceTypeCode).then(setActions).catch(function () {
      return setActions([]);
    });
  }, [api, open, resourceTypeCode, isEditing]);
  useEffect(function () {
    if (!open || isEditing) return;
    if (bindType === 'USER') {
      api.listUsers().then(function (users) {
        return setUserOptions(formatUsers(users));
      }).catch(function () {
        return setUserOptions([]);
      });
      return;
    }
    api.listDeptTree().then(function (depts) {
      return setDeptOptions(flattenDepts(depts));
    }).catch(function () {
      return setDeptOptions([]);
    });
  }, [api, bindType, open, isEditing]);
  var resourceTypeName = useMemo(function () {
    var resourceType = resourceTypes.find(function (item) {
      return item.typeCode === resourceTypeCode;
    });
    return resourceType ? "".concat(resourceType.typeName, " (").concat(resourceType.typeCode, ")") : resourceTypeCode;
  }, [resourceTypeCode, resourceTypes]);
  var generatePolicyCode = function generatePolicyCode() {
    var timestamp = Date.now().toString(36).toUpperCase();
    var random = Math.random().toString(36).substring(2, 6).toUpperCase();
    var prefix = resourceTypeCode ? resourceTypeCode.toUpperCase() : 'POLICY';
    return "".concat(prefix, "_").concat(timestamp, "_").concat(random);
  };
  var handleSubjectChange = function handleSubjectChange(value) {
    var options = bindType === 'USER' ? userOptions : deptOptions;
    var selected = options.find(function (option) {
      return option.value === value;
    });
    form.setFieldValue('bindName', (selected === null || selected === void 0 ? void 0 : selected.label) || value);
  };
  var submitPolicy = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
      var values, bindName;
      return _regeneratorRuntime().wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return form.validateFields();
          case 3:
            values = _context.sent;
            setSubmitting(true);
            bindName = values.bindName || values.bindId;
            _context.next = 8;
            return api.createPolicy({
              policyName: "".concat(resourceTypeName, "-").concat(resourceName, "-").concat(bindName, "\u7684\u4E2A\u6027\u5316\u6388\u6743"),
              policyCode: generatePolicyCode(),
              resourceTypeCode: resourceTypeCode,
              policyCategory: PolicyCategory.PERSONALIZED,
              bindType: values.bindType,
              bindId: values.bindId,
              policyContent: JSON.stringify({
                Statement: {
                  Effect: 'Allow',
                  Action: values.actions,
                  Resource: [{
                    code: "@id:exact:".concat(resourceId),
                    name: resourceName
                  }]
                }
              })
            });
          case 8:
            messageApi.success('授权成功');
            onSuccess === null || onSuccess === void 0 || onSuccess();
            onClose();
            _context.next = 18;
            break;
          case 13:
            _context.prev = 13;
            _context.t0 = _context["catch"](0);
            if (!(_context.t0 !== null && _context.t0 !== void 0 && _context.t0.errorFields)) {
              _context.next = 17;
              break;
            }
            return _context.abrupt("return");
          case 17:
            messageApi.error(getErrorMessage(_context.t0, '授权失败'));
          case 18:
            _context.prev = 18;
            setSubmitting(false);
            return _context.finish(18);
          case 21:
          case "end":
            return _context.stop();
        }
      }, _callee, null, [[0, 13, 18, 21]]);
    }));
    return function handleSubmit() {
      return _ref2.apply(this, arguments);
    };
  }();
  var handleSubmit = function () {
    if (!isEditing) return submitPolicy();
  };
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [messageContextHolder, /*#__PURE__*/_jsx(_Drawer, {
      title: title,
      size: width,
      autoFocus: !isEditing,
      focusable: isEditing ? { trap: false, focusTriggerAfterClose: false } : undefined,
      destroyOnHidden: isEditing,
      open: open,
      onClose: onClose,
      footer: /*#__PURE__*/_jsx("div", {
        className: styles.drawerFooter,
        children: /*#__PURE__*/_jsxs(_Space, {
          children: [/*#__PURE__*/_jsx(_Button, {
            onClick: onClose,
            children: "\u53D6\u6D88"
          }), /*#__PURE__*/_jsx(_Button, {
            type: "primary",
            loading: submitting,
            disabled: isEditing,
            onClick: handleSubmit,
            children: "\u786E\u8BA4\u6388\u6743"
          })]
        })
      }),
      children: /*#__PURE__*/_jsxs(_Spin, {
        spinning: loading,
        children: [/*#__PURE__*/_jsxs(_Descriptions, {
          title: "\u8D44\u6E90\u4FE1\u606F",
          column: 1,
          bordered: true,
          size: "small",
          children: [/*#__PURE__*/_jsx(_Descriptions.Item, {
            label: "\u7C7B\u578B",
            children: resourceTypeName
          }), /*#__PURE__*/_jsx(_Descriptions.Item, {
            label: "\u8D44\u6E90ID",
            children: resourceId
          }), /*#__PURE__*/_jsx(_Descriptions.Item, {
            label: "\u8D44\u6E90\u540D\u79F0",
            children: resourceName
          })]
        }), /*#__PURE__*/_jsx(_Divider, {}), /*#__PURE__*/_jsxs(_Form, {
          form: form,
          disabled: isEditing,
          layout: "vertical",
          initialValues: {
            bindType: 'USER',
            actions: ['READ']
          },
          children: [/*#__PURE__*/_jsx(_Form.Item, {
            name: "bindType",
            label: "\u4E3B\u4F53\u7C7B\u578B",
            rules: [{
              required: true
            }],
            children: /*#__PURE__*/_jsx(_Select, {
              onChange: function onChange(value) {
                setBindType(value);
                form.setFieldValue('bindId', undefined);
                form.setFieldValue('bindName', undefined);
              },
              options: [{
                value: 'USER',
                label: '用户'
              }, {
                value: 'DEPT',
                label: '组织'
              }]
            })
          }), /*#__PURE__*/_jsx(_Form.Item, {
            name: "bindId",
            label: "\u9009\u62E9\u4E3B\u4F53",
            rules: [{
              required: true,
              message: '请选择主体'
            }],
            children: /*#__PURE__*/_jsx(_Select, {
              showSearch: true,
              placeholder: "\u8BF7\u9009\u62E9",
              optionFilterProp: "label",
              options: bindType === 'USER' ? userOptions : deptOptions,
              onChange: handleSubjectChange
            })
          }), /*#__PURE__*/_jsx(_Form.Item, {
            name: "bindName",
            hidden: true,
            children: /*#__PURE__*/_jsx(_Input, {})
          }), /*#__PURE__*/_jsx(_Form.Item, {
            name: "actions",
            label: "\u6388\u6743\u52A8\u4F5C",
            rules: [{
              required: true,
              message: '请选择授权动作'
            }],
            children: /*#__PURE__*/_jsx(_Checkbox.Group, {
              className: styles.actionCheckboxGroup,
              children: actions.map(function (action) {
                return /*#__PURE__*/_jsxs(_Checkbox, {
                  value: action.code,
                  children: [action.name, " (", action.code, ")"]
                }, action.code);
              })
            })
          })]
        })]
      })
    })]
  });
}
export var Authorization = withConfigProvider(AuthorizationCom);
Authorization.Record = withConfigProvider(Record);
export default Authorization;
