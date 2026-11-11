import { Tooltip as _Tooltip } from "antd";
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
import * as React from 'react';
import { jsx as _jsx } from "react/jsx-runtime";
/** 按展示顺序寻找首个可选项；列表展开分组，树按先父后子的顺序查找。 */
export var findFirstSelectableOption = function findFirstSelectableOption(items, isTree, isCheckable) {
  var _iterator = _createForOfIteratorHelper(items),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _item$children;
      var item = _step.value;
      if (!isTree && Array.isArray(item.options)) {
        var first = !item.disabled && findFirstSelectableOption(item.options, false, false);
        if (first) return first;
        continue;
      }
      if (item.value != null && !item.disabled && (isCheckable ? !item.disableCheckbox && item.checkable !== false : item.selectable !== false)) {
        return item;
      }
      if (isTree && (_item$children = item.children) !== null && _item$children !== void 0 && _item$children.length) {
        var _first = findFirstSelectableOption(item.children, true, isCheckable);
        if (_first) return _first;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
};

/** 正式字典接口不保证顺序；同序号按编码排序，不修改原始数据。 */
var sortDictItems = function sortDictItems(items) {
  return _toConsumableArray(items).sort(function (a, b) {
    var _a$seq, _b$seq, _a$dictItemCode, _b$dictItemCode;
    return ((_a$seq = a.seq) !== null && _a$seq !== void 0 ? _a$seq : 0) - ((_b$seq = b.seq) !== null && _b$seq !== void 0 ? _b$seq : 0) || String((_a$dictItemCode = a.dictItemCode) !== null && _a$dictItemCode !== void 0 ? _a$dictItemCode : '').localeCompare(String((_b$dictItemCode = b.dictItemCode) !== null && _b$dictItemCode !== void 0 ? _b$dictItemCode : ''));
  });
};

/**
 * 将正式字典的扁平列表按 parentItemCode 构建为树，并生成完整路径。
 */
export var formatTreeData = function formatTreeData(data, labelField, valueField, separator, treeNodeTitleClassName, adaptor) {
  var formattedData = adaptor ? adaptor(data) : data;
  if (!Array.isArray(formattedData)) return [];
  var itemCodes = new Set(formattedData.map(function (node) {
    return node.dictItemCode;
  }));
  var roots = [];
  var childrenByParent = new Map();
  var _iterator2 = _createForOfIteratorHelper(sortDictItems(formattedData)),
    _step2;
  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var node = _step2.value;
      var parentCode = node.parentItemCode;
      if (parentCode && parentCode !== node.dictItemCode && itemCodes.has(parentCode)) {
        var _childrenByParent$get;
        var children = (_childrenByParent$get = childrenByParent.get(parentCode)) !== null && _childrenByParent$get !== void 0 ? _childrenByParent$get : [];
        children.push(node);
        childrenByParent.set(parentCode, children);
      } else {
        roots.push(node);
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }
  var formatNode = function formatNode(node) {
    var parentPath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    var nodeName = node[labelField];
    var value = node[valueField];
    if (!value) return null;
    var fullPath = parentPath ? "".concat(parentPath).concat(separator).concat(nodeName) : nodeName;
    var result = {
      label: /*#__PURE__*/_jsx(_Tooltip, {
        title: fullPath,
        placement: "topLeft",
        children: /*#__PURE__*/_jsx("span", {
          className: treeNodeTitleClassName,
          children: nodeName
        })
      }),
      title: nodeName,
      fullPath: fullPath,
      value: value,
      origin: node,
      disabled: Boolean(node.disabled)
    };
    var children = childrenByParent.get(node.dictItemCode);
    if (children !== null && children !== void 0 && children.length) {
      result.children = children.map(function (child) {
        return formatNode(child, fullPath);
      }).filter(function (n) {
        return n !== null;
      });
    }
    return result;
  };
  return roots.map(function (node) {
    return formatNode(node);
  }).filter(function (n) {
    return n !== null;
  });
};

/**
 * 本地搜索过滤器：支持按名称（title）、编码（value）及完整路径（fullPath）即时过滤
 */
export var defaultFilterTreeNode = function defaultFilterTreeNode(inputValue, treeNode) {
  var _treeNode$title, _treeNode$value, _treeNode$fullPath;
  if (!inputValue) return true;
  var keyword = inputValue.toLowerCase().trim();
  var title = String((_treeNode$title = treeNode === null || treeNode === void 0 ? void 0 : treeNode.title) !== null && _treeNode$title !== void 0 ? _treeNode$title : '').toLowerCase();
  var val = String((_treeNode$value = treeNode === null || treeNode === void 0 ? void 0 : treeNode.value) !== null && _treeNode$value !== void 0 ? _treeNode$value : '').toLowerCase();
  var fullPath = String((_treeNode$fullPath = treeNode === null || treeNode === void 0 ? void 0 : treeNode.fullPath) !== null && _treeNode$fullPath !== void 0 ? _treeNode$fullPath : '').toLowerCase();
  return title.includes(keyword) || val.includes(keyword) || fullPath.includes(keyword);
};

/** 将正式字典的全部条目排序后映射为 Select 选项。 */
export var formatListData = function formatListData(data, labelField, valueField, adaptor) {
  var items = adaptor ? adaptor(data) : data;
  if (!Array.isArray(items)) return [];
  return sortDictItems(items.filter(function (item) {
    return item && item[valueField];
  })).map(function (item) {
    return {
      label: item[labelField],
      title: item[labelField],
      value: item[valueField],
      disabled: Boolean(item.disabled),
      origin: item
    };
  });
};
