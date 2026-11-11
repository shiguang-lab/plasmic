/**
 * 格式化海外用户全量数据为 Select 选项列表
 */
export var formatUserData = function formatUserData(responseData, adaptor, labelRender) {
  var valueKey = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'userId';
  var labelKey = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'nickname';
  var data = adaptor ? adaptor(responseData) : responseData;
  if (!Array.isArray(data)) return [];
  return data.filter(function (user) {
    return user && user[valueKey] !== undefined && user[valueKey] !== null;
  }).map(function (user) {
    var _user$username, _ref, _user$labelKey;
    var val = String(user[valueKey]);
    var username = String((_user$username = user.username) !== null && _user$username !== void 0 ? _user$username : '');
    var nickname = String((_ref = (_user$labelKey = user[labelKey]) !== null && _user$labelKey !== void 0 ? _user$labelKey : user.nickname) !== null && _ref !== void 0 ? _ref : '');
    var label;
    if (labelRender) {
      label = labelRender(user);
    } else if (nickname && username) {
      label = "".concat(nickname, " (").concat(username, ")");
    } else {
      label = nickname || username || val;
    }
    return {
      label: label,
      value: val,
      origin: user,
      username: username,
      nickname: nickname,
      disabled: Boolean(user.disabled)
    };
  });
};

/**
 * 本地多字段即时搜索匹配器
 * 支持对 用户名 (username)、昵称 (nickname)、邮箱、手机号及 ID 进行无损匹配
 */
export var defaultFilterOption = function defaultFilterOption(input, option) {
  if (!input || !option) return true;
  var keyword = input.trim().toLowerCase();
  if (!keyword) return true;
  var raw = option.origin || {};
  var username = String(raw.username || '').toLowerCase();
  var nickname = String(raw.nickname || '').toLowerCase();
  var value = String(option.value || '').toLowerCase();
  var email = String(raw.email || '').toLowerCase();
  var phone = String(raw.phone || '').toLowerCase();
  if (username.includes(keyword) || nickname.includes(keyword) || value.includes(keyword) || email.includes(keyword) || phone.includes(keyword)) {
    return true;
  }
  if (typeof option.label === 'string' && option.label.toLowerCase().includes(keyword)) {
    return true;
  }
  return false;
};
