function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var SUCCESS_CODES = new Set([200, '200', 0, '0']);
export var isResponseObject = function isResponseObject(value) {
  return value !== null && _typeof(value) === 'object' && !Array.isArray(value);
};

/** 只解析一层业务包装；业务字段由调用方按接口契约识别。 */
export function unwrapBusinessResponse(payload) {
  var hasBusinessFields = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Array.isArray;
  var context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'API';
  if (isResponseObject(payload) && 'code' in payload && (!hasBusinessFields(payload) || typeof payload.message === 'string' || typeof payload.msg === 'string')) {
    if (!SUCCESS_CODES.has(payload.code)) {
      // 不弹提示，由原调用方处理失败；保留已有错误文案读取路径。
      throw Object.assign(new Error("".concat(context, " request failed with code ").concat(String(payload.code))), {
        response: {
          data: payload
        }
      });
    }
    return payload.data;
  }
  return payload;
}

/** 保留列表/权限接口已有的一层传输包装，不递归猜测 data。 */
export function unwrapRequestResponse(payload) {
  var hasBusinessFields = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Array.isArray;
  var context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'API';
  var body = isResponseObject(payload) && !('code' in payload) && 'data' in payload && !hasBusinessFields(payload) ? payload.data : payload;
  return unwrapBusinessResponse(body, hasBusinessFields, context);
}
export function resolveArrayResponse(payload) {
  var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'API';
  var data = unwrapRequestResponse(payload, Array.isArray, context);
  if (!Array.isArray(data)) throw new Error("Invalid ".concat(context.toLowerCase(), " response"));
  return data;
}
