"use strict";

var Ant = require("antd");
var React = require("react");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

function AntdTree(props) {
  return /* @__PURE__ */ React__default.default.createElement(Ant.Tree, {
    ...props,
  });
}
function AntdDirectoryTree(props) {
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Tree.DirectoryTree,
    { ...props },
  );
}
const treeHelpers_ = {
  states: {
    selectedKeys: {
      onChangeArgsToValue: (selectedKeys, _info) => {
        return selectedKeys;
      },
    },
    selectedNodes: {
      onChangeArgsToValue: (_selectedKeys, info) => {
        return info.selectedNodes;
      },
    },
    expandedKeys: {
      onChangeArgsToValue: (expandedKeys, _info) => {
        return expandedKeys;
      },
    },
    checkedKeys: {
      onChangeArgsToValue: (checkedKeys, _info) => {
        return checkedKeys;
      },
    },
    checkedNodes: {
      onChangeArgsToValue: (_checkedKeys, info) => {
        return info.checkedNodes;
      },
    },
    checkedDetails: {
      onChangeArgsToValue: (_checkedKeys, info) => {
        return {
          checkedNodesPositions: info.checkedNodesPositions,
          halfCheckedKeys: info.halfCheckedKeys,
        };
      },
    },
  },
};
const treeHelpers = treeHelpers_;
const treeData = [
  {
    title: "Node 0",
    key: "0",
    children: [
      {
        title: "Node 0-0",
        key: "0-0",
        children: [
          {
            title: "Node 0-0-0",
            key: "0-0-0",
            disableCheckbox: true,
          },
          {
            title: "Node 0-0-1",
            key: "0-0-1",
            disabled: true,
          },
          {
            title: "Node 0-0-2",
            key: "0-0-2",
          },
        ],
      },
      {
        title: "Node 0-1",
        key: "0-1",
        children: [
          {
            title: "Node 0-1-0",
            key: "0-1-0",
          },
          {
            title: "Node 0-1-1",
            key: "0-1-1",
          },
        ],
      },
    ],
  },
];
function registerTreeHelper({
  loader,
  component,
  name,
  displayName,
  importName,
  checkableDefaultValue,
  expandActionDefaultValue,
}) {
  utils.registerComponentHelper(loader, component, {
    name,
    displayName,
    props: {
      treeData: {
        type: "array",
        defaultValue: treeData,
      },
      checkable: {
        type: "boolean",
        defaultValue: checkableDefaultValue,
      },
      selectable: {
        type: "boolean",
        defaultValueHint: true,
      },
      checkedKeys: {
        type: "array",
        editOnly: true,
        uncontrolledProp: "defaultCheckedKeys",
        description: "List of checked keys.",
        hidden: (ps) => !ps.checkable,
      },
      selectedKeys: {
        type: "array",
        editOnly: true,
        uncontrolledProp: "defaultSelectedKeys",
        description: "List of selected keys.",
        hidden: (ps) => !(ps.selectable ?? true),
        advanced: true,
      },
      expandedKeys: {
        type: "array",
        editOnly: true,
        uncontrolledProp: "defaultExpandedKeys",
        description: "List of expanded keys.",
        // hidden: (ps: any) => !ps.expa,
        advanced: true,
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false,
      },
      showLine: {
        type: "boolean",
        defaultValueHint: false,
      },
      defaultExpandAll: {
        type: "boolean",
        description:
          "Whether to automatically expand all nodes at initialization",
        defaultValueHint: false,
      },
      autoExpandParent: {
        type: "boolean",
        description: "Whether to automatically expand a parent node",
        defaultValueHint: false,
        advanced: true,
      },
      defaultExpandParent: {
        type: "boolean",
        description:
          "Whether to automatically expand a parent node at initialization",
        defaultValueHint: true,
        advanced: true,
      },
      expandAction: {
        type: "choice",
        options: [
          {
            label: "None",
            value: false,
          },
          {
            label: "Click",
            value: "click",
          },
          {
            label: "Double click",
            value: "doubleClick",
          },
        ],
        defaultValueHint: expandActionDefaultValue,
      },
      multiple: {
        type: "boolean",
        defaultValueHint: false,
        description: "Whether to allow multiple selection",
        advanced: true,
      },
      icon: { type: "slot", hidePlaceholder: true },
      switcherIcon: { type: "slot", hidePlaceholder: true },
      showIcon: "boolean",
      titleRender: {
        type: "slot",
        hidePlaceholder: true,
        renderPropParams: ["node"],
      },
      // draggable: {
      //   type: "boolean",
      //   defaultValueHint: false,
      //   advanced: true,
      // },
      // allowDrop: {
      //   type: "boolean",
      //   defaultValueHint: false,
      //   advanced: true,
      //   description: "Whether to allow dropping on the node",
      // },
      onSelect: {
        type: "eventHandler",
        argTypes: [
          { name: "selectedKeys", type: { type: "array" } },
          {
            name: "selectedNodes",
            type: { type: "array" },
          },
        ],
      },
      onCheck: {
        type: "eventHandler",
        argTypes: [
          { name: "checkedKeys", type: { type: "array" } },
          {
            name: "checkDetails",
            type: { type: "object" },
          },
        ],
      },
      onExpand: {
        type: "eventHandler",
        argTypes: [
          { name: "expandedKeys", type: { type: "array" } },
          {
            name: "expandDetails",
            type: { type: "object" },
          },
        ],
      },
    },
    states: {
      checkedKeys: {
        type: "writable",
        valueProp: "checkedKeys",
        onChangeProp: "onCheck",
        variableType: "array",
        ...treeHelpers_.states.checkedKeys,
      },
      checkedNodes: {
        type: "readonly",
        onChangeProp: "onCheck",
        variableType: "array",
        initVal: [],
        ...treeHelpers_.states.checkedNodes,
      },
      checkedDetails: {
        type: "readonly",
        onChangeProp: "onCheck",
        variableType: "object",
        initVal: {
          checkedNodesPositions: [],
          halfCheckedKeys: [],
        },
        ...treeHelpers_.states.checkedDetails,
      },
      selectedKeys: {
        type: "writable",
        valueProp: "selectedKeys",
        onChangeProp: "onSelect",
        variableType: "array",
        ...treeHelpers_.states.selectedKeys,
      },
      selectedNodes: {
        type: "readonly",
        onChangeProp: "onSelect",
        variableType: "array",
        initVal: [],
        ...treeHelpers_.states.selectedNodes,
      },
      expandedKeys: {
        type: "writable",
        valueProp: "expandedKeys",
        onChangeProp: "onExpand",
        variableType: "array",
        ...treeHelpers_.states.expandedKeys,
      },
    },
    componentHelpers: {
      helpers: treeHelpers_,
      importName: "treeHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTree",
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTree",
    importName,
  });
}
function registerTree(loader) {
  registerTreeHelper({
    loader,
    component: AntdTree,
    name: "plasmic-antd6-tree",
    displayName: "Tree",
    importName: "AntdTree",
    checkableDefaultValue: true,
    expandActionDefaultValue: false,
  });
}
function registerDirectoryTree(loader) {
  registerTreeHelper({
    loader,
    component: AntdDirectoryTree,
    name: "plasmic-antd6-directory-tree",
    displayName: "Directory Tree",
    importName: "AntdDirectoryTree",
    checkableDefaultValue: false,
    expandActionDefaultValue: "click",
  });
}

exports.AntdDirectoryTree = AntdDirectoryTree;
exports.AntdTree = AntdTree;
exports.registerDirectoryTree = registerDirectoryTree;
exports.registerTree = registerTree;
exports.treeData = treeData;
exports.treeHelpers = treeHelpers;
//# sourceMappingURL=registerTree.cjs.js.map
