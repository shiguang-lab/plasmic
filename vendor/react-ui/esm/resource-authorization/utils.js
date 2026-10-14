function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
export var flattenDepts = function flattenDepts(depts) {
  var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  if (!Array.isArray(depts)) return [];
  return depts.reduce(function (acc, dept) {
    var _dept$children;
    var label = prefix ? "".concat(prefix, " / ").concat(dept.name) : dept.name;
    acc.push({
      value: dept.code,
      label: label
    });
    if ((_dept$children = dept.children) !== null && _dept$children !== void 0 && _dept$children.length) {
      acc.push.apply(acc, _toConsumableArray(flattenDepts(dept.children, label)));
    }
    return acc;
  }, []);
};
export var formatUsers = function formatUsers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter(function (user) {
    return user.userId;
  }).map(function (user) {
    return {
      value: user.userId,
      label: user.nickname || user.name || user.username || user.userId
    };
  });
};
export var getErrorMessage = function getErrorMessage(error, fallback) {
  var _anyError$response;
  var anyError = error;
  var data = anyError === null || anyError === void 0 || (_anyError$response = anyError.response) === null || _anyError$response === void 0 ? void 0 : _anyError$response.data;
  return (data === null || data === void 0 ? void 0 : data.developerMessage) || (data === null || data === void 0 ? void 0 : data.msg) || (data === null || data === void 0 ? void 0 : data.message) || fallback;
};
