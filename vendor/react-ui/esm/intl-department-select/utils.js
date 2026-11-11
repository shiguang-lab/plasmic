/**
 * 递归格式化海外组织架构树数据
 */
export var formatDeptTreeData = function formatDeptTreeData(nodes) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var parentPath = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var _options$labelField = options.labelField,
    labelField = _options$labelField === void 0 ? 'label' : _options$labelField,
    _options$valueField = options.valueField,
    valueField = _options$valueField === void 0 ? 'value' : _options$valueField,
    _options$pathSeparato = options.pathSeparator,
    pathSeparator = _options$pathSeparato === void 0 ? ' / ' : _options$pathSeparato,
    labelRender = options.labelRender,
    adaptor = options.adaptor;
  var currentNodes = parentPath === '' && adaptor ? adaptor(nodes) : nodes;
  if (!Array.isArray(currentNodes)) return [];
  return currentNodes.filter(function (node) {
    return node && node[valueField] !== undefined && node[valueField] !== null;
  }).map(function (node) {
    var _ref, _node$labelField;
    var val = String(node[valueField]);
    var labelText = String((_ref = (_node$labelField = node[labelField]) !== null && _node$labelField !== void 0 ? _node$labelField : node.name) !== null && _ref !== void 0 ? _ref : val);
    var currentFullPath = parentPath ? "".concat(parentPath).concat(pathSeparator).concat(labelText) : labelText;
    var displayLabel;
    if (labelRender) {
      displayLabel = labelRender(node);
    } else {
      displayLabel = labelText;
    }
    var formattedNode = {
      label: displayLabel,
      title: displayLabel,
      value: val,
      fullPath: currentFullPath,
      origin: node,
      disabled: Boolean(node.disabled)
    };
    if (Array.isArray(node.children) && node.children.length > 0) {
      formattedNode.children = formatDeptTreeData(node.children, {
        labelField: labelField,
        valueField: valueField,
        pathSeparator: pathSeparator,
        labelRender: labelRender
      }, currentFullPath);
    }
    return formattedNode;
  });
};

/**
 * 组织架构树本地即时搜索匹配器
 * 支持对节点标签名称、节点编码 (value) 以及层级完整路径 (fullPath) 进行模糊匹配
 */
export var defaultFilterTreeNode = function defaultFilterTreeNode(inputValue, treeNode) {
  if (!inputValue || !treeNode) return true;
  var keyword = inputValue.trim().toLowerCase();
  if (!keyword) return true;
  var label = typeof treeNode.label === 'string' ? treeNode.label.toLowerCase() : '';
  var title = typeof treeNode.title === 'string' ? treeNode.title.toLowerCase() : '';
  var value = String(treeNode.value || '').toLowerCase();
  var fullPath = String(treeNode.fullPath || '').toLowerCase();
  var origin = treeNode.origin || {};
  var originLabel = String(origin.label || origin.name || '').toLowerCase();
  var originCode = String(origin.value || origin.deptCode || origin.id || '').toLowerCase();
  return label.includes(keyword) || title.includes(keyword) || value.includes(keyword) || fullPath.includes(keyword) || originLabel.includes(keyword) || originCode.includes(keyword);
};
