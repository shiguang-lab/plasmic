import _notification from "antd/es/notification/index.js";
import _Modal from "antd/es/modal/index.js";
import _message from "antd/es/message/index.js";
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
import { createContext, useContext } from 'react';

/** UI 组件库静态方法上下文 */
import { jsxs as _jsxs } from "react/jsx-runtime";
var UIStaticMethodsContext = /*#__PURE__*/createContext(null);

/** 内部组件：获取 hooks 实例并注入 Context */
function UIStaticMethodsProvider(_ref) {
  var children = _ref.children;
  var _message$useMessage = _message.useMessage(),
    _message$useMessage2 = _slicedToArray(_message$useMessage, 2),
    messageApi = _message$useMessage2[0],
    messageContextHolder = _message$useMessage2[1];
  var _Modal$useModal = _Modal.useModal(),
    _Modal$useModal2 = _slicedToArray(_Modal$useModal, 2),
    modal = _Modal$useModal2[0],
    modalContextHolder = _Modal$useModal2[1];
  var _notification$useNoti = _notification.useNotification(),
    _notification$useNoti2 = _slicedToArray(_notification$useNoti, 2),
    notificationApi = _notification$useNoti2[0],
    notificationContextHolder = _notification$useNoti2[1];
  return /*#__PURE__*/_jsxs(UIStaticMethodsContext.Provider, {
    value: {
      message: messageApi,
      modal: modal,
      notification: notificationApi
    },
    children: [messageContextHolder, modalContextHolder, notificationContextHolder, children]
  });
}

/** 获取 UI 组件库封装的静态方法 */
export function useUIStaticMethods() {
  var context = useContext(UIStaticMethodsContext);
  if (!context) {
    throw new Error('useUIStaticMethods must be used within ConfigProvider');
  }
  return context;
}
export { UIStaticMethodsProvider };