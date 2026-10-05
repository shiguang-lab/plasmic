function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
import _Dropdown from "antd/es/dropdown/index.js";
import _Tooltip from "antd/es/tooltip/index.js";
import _Button from "antd/es/button/index.js";
import _Divider from "antd/es/divider/index.js";
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
import { Children, isValidElement, useMemo } from 'react';
import { DownOutlined } from '@ant-design/icons';
import cc from 'classcat';
import styles from "./styles.js";

/** 过滤 items 中的 falsy 值 */
import { jsx as _jsx } from "react/jsx-runtime";
import { jsxs as _jsxs } from "react/jsx-runtime";
function filterItems(items) {
  return items.filter(Boolean);
}

/**
 * 将列表按 max 拆分为 visible / overflow。
 *
 * - 总数 <= max：全部直接展示，不折叠（无"更多"）。
 * - 总数 > max：折叠溢出项，此时"更多"按钮本身占用一个位置，因此仅直接展示 max - 1 个，
 *   其余全部收进"更多"下拉。
 */
function splitByMax(list, max) {
  if (list.length <= max) {
    return {
      visible: list,
      overflow: []
    };
  }
  var visibleCount = Math.max(max - 1, 0);
  return {
    visible: list.slice(0, visibleCount),
    overflow: list.slice(visibleCount)
  };
}

/** 将 ActionItem[] 转为 antd MenuProps['items'] */
function toMenuItems(items) {
  return items.map(function (item, index) {
    var _item$key;
    return {
      key: (_item$key = item.key) !== null && _item$key !== void 0 ? _item$key : "action-".concat(index),
      icon: item.icon,
      label: item.label,
      disabled: item.disabled,
      danger: item.danger,
      onClick: item.onClick
    };
  });
}

/** 过滤 children 中的 falsy 值，返回有效的 ReactElement 数组 */
function filterChildren(children) {
  var result = [];
  Children.forEach(children, function (child) {
    if ( /*#__PURE__*/isValidElement(child)) {
      result.push(child);
    }
  });
  return result;
}

/**
 * 将超出的 children 元素转为 antd MenuProps['items']
 * 从 element.props 中提取 children→label、onClick、danger、disabled、icon
 */
function childrenToMenuItems(elements) {
  return elements.map(function (el, index) {
    var _el$key;
    var props = el.props || {};
    return {
      key: (_el$key = el.key) !== null && _el$key !== void 0 ? _el$key : "action-".concat(index),
      label: props.children,
      onClick: props.onClick,
      danger: props.danger,
      disabled: props.disabled,
      icon: props.icon
    };
  });
}

/** 解析 divider prop 为 ReactNode 或 null */
function resolveDivider(divider) {
  if (divider === false || divider === undefined) return null;
  if (divider === true) {
    return /*#__PURE__*/_jsx(_Divider, {
      type: "vertical",
      className: styles.divider,
      style: {
        margin: '0 2px',
        height: '1em'
      }
    });
  }
  return divider;
}

/** 在元素之间插入分隔符 */
function interleaveWithSeparator(elements, separator) {
  var result = [];
  elements.forEach(function (el, i) {
    if (i > 0) {
      result.push( /*#__PURE__*/_jsx("span", {
        children: separator
      }, "sep-".concat(i)));
    }
    result.push(el);
  });
  return result;
}

/** items 模式下单个可见操作项的渲染 */
var ItemButton = function ItemButton(_ref) {
  var _item$key2, _item$key3;
  var item = _ref.item,
    index = _ref.index,
    buttonType = _ref.buttonType,
    buttonSize = _ref.buttonSize;
  var btn = /*#__PURE__*/_jsx(_Button, {
    type: buttonType,
    size: buttonSize,
    icon: item.icon,
    disabled: item.disabled,
    danger: item.danger,
    className: styles.actionBtn,
    onClick: function onClick(e) {
      var _item$onClick;
      e.stopPropagation();
      (_item$onClick = item.onClick) === null || _item$onClick === void 0 || _item$onClick.call(item);
    },
    children: item.label
  }, (_item$key2 = item.key) !== null && _item$key2 !== void 0 ? _item$key2 : "action-".concat(index));
  return item.tooltip ? /*#__PURE__*/_jsx(_Tooltip, {
    title: item.tooltip,
    children: btn
  }, (_item$key3 = item.key) !== null && _item$key3 !== void 0 ? _item$key3 : "action-".concat(index)) : btn;
};

/** "更多"下拉按钮 */
var MoreButton = function MoreButton(_ref2) {
  var menuItems = _ref2.menuItems,
    text = _ref2.text,
    icon = _ref2.icon,
    buttonType = _ref2.buttonType,
    buttonSize = _ref2.buttonSize,
    dropdownProps = _ref2.dropdownProps;
  var resolvedIcon = icon === false ? null : icon !== null && icon !== void 0 ? icon : /*#__PURE__*/_jsx(DownOutlined, {});
  return /*#__PURE__*/_jsx(_Dropdown, _objectSpread(_objectSpread({
    trigger: ['click'],
    placement: "bottomRight"
  }, dropdownProps), {}, {
    menu: {
      items: menuItems
    },
    children: /*#__PURE__*/_jsxs(_Button, {
      type: buttonType,
      size: buttonSize,
      className: styles.moreBtn,
      styles: {
        icon: {
          marginInlineStart: 0,
          fontSize: '10px'
        }
      },
      onClick: function onClick(e) {
        return e.stopPropagation();
      },
      children: [text, resolvedIcon]
    })
  }));
};
export var ActionGroup = function ActionGroup(_ref3) {
  var items = _ref3.items,
    children = _ref3.children,
    _ref3$max = _ref3.max,
    max = _ref3$max === void 0 ? 3 : _ref3$max,
    dividerProp = _ref3.divider,
    _ref3$moreText = _ref3.moreText,
    moreText = _ref3$moreText === void 0 ? '更多' : _ref3$moreText,
    moreIcon = _ref3.moreIcon,
    _ref3$moreButtonType = _ref3.moreButtonType,
    moreButtonType = _ref3$moreButtonType === void 0 ? 'link' : _ref3$moreButtonType,
    _ref3$moreButtonSize = _ref3.moreButtonSize,
    moreButtonSize = _ref3$moreButtonSize === void 0 ? 'small' : _ref3$moreButtonSize,
    dropdownProps = _ref3.dropdownProps,
    className = _ref3.className,
    style = _ref3.style;
  var separator = resolveDivider(dividerProp);

  // items 模式
  var itemsResult = useMemo(function () {
    if (!items) return null;
    var valid = filterItems(items);
    if (valid.length === 0) return null;
    return splitByMax(valid, max);
  }, [items, max]);

  // children 模式
  var childrenResult = useMemo(function () {
    if (items) return null; // items 优先
    var valid = filterChildren(children);
    if (valid.length === 0) return null;
    return splitByMax(valid, max);
  }, [items, children, max]);

  // items 模式渲染
  if (itemsResult) {
    var visible = itemsResult.visible,
      overflow = itemsResult.overflow;
    var menuItems = overflow.length > 0 ? toMenuItems(overflow) : null;
    var visibleNodes = visible.map(function (item, i) {
      var _item$key4;
      return /*#__PURE__*/_jsx(ItemButton, {
        item: item,
        index: i,
        buttonType: moreButtonType,
        buttonSize: moreButtonSize
      }, (_item$key4 = item.key) !== null && _item$key4 !== void 0 ? _item$key4 : "action-".concat(i));
    });
    if (menuItems) {
      visibleNodes.push( /*#__PURE__*/_jsx(MoreButton, {
        menuItems: menuItems,
        text: moreText,
        icon: moreIcon,
        buttonType: moreButtonType,
        buttonSize: moreButtonSize,
        dropdownProps: dropdownProps
      }, "more"));
    }
    var parts = separator ? interleaveWithSeparator(visibleNodes, separator) : visibleNodes;
    return /*#__PURE__*/_jsx("div", {
      className: cc([styles.actionGroup, className]),
      style: style,
      children: parts
    });
  }

  // children 模式渲染
  if (childrenResult) {
    var _visible = childrenResult.visible,
      _overflow = childrenResult.overflow;
    var _menuItems = _overflow.length > 0 ? childrenToMenuItems(_overflow) : null;
    var _visibleNodes = _toConsumableArray(_visible);
    if (_menuItems) {
      _visibleNodes.push( /*#__PURE__*/_jsx(MoreButton, {
        menuItems: _menuItems,
        text: moreText,
        icon: moreIcon,
        buttonType: moreButtonType,
        buttonSize: moreButtonSize,
        dropdownProps: dropdownProps
      }, "more"));
    }
    var _parts = separator ? interleaveWithSeparator(_visibleNodes, separator) : _visibleNodes;
    return /*#__PURE__*/_jsx("div", {
      className: cc([styles.actionGroup, className]),
      style: style,
      children: _parts
    });
  }
  return null;
};