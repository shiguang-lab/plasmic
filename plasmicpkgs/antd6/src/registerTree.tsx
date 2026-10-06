import type { TreeDataNode, TreeProps } from "antd";
import { Tree } from "antd";
import type { DirectoryTreeProps } from "antd/es/tree";
import React, { Key } from "react";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdTree(props: TreeProps) {
  return <Tree {...props} />;
}

// AntdTree.__plasmicFormFieldMeta = {
//   valueProp: "checkedKeys",
//   onChangePropName: "onChange",
// };

export function AntdDirectoryTree(props: DirectoryTreeProps) {
  return <Tree.DirectoryTree {...props} />;
}

export interface CheckedDetails<
  TreeDataType extends TreeDataNode = TreeDataNode,
> {
  halfCheckedKeys: Key[];
  checkedNodesPositions?: {
    node: TreeDataType;
    pos: string;
  }[];
}

const treeHelpers_ = {
  states: {
    selectedKeys: {
      onChangeArgsToValue: ((selectedKeys, _info) => {
        return selectedKeys;
      }) as TreeProps["onSelect"],
    },
    selectedNodes: {
      onChangeArgsToValue: ((_selectedKeys, info) => {
        return info.selectedNodes;
      }) as TreeProps["onSelect"],
    },
    expandedKeys: {
      onChangeArgsToValue: ((expandedKeys, _info) => {
        return expandedKeys;
      }) as TreeProps["onExpand"],
    },
    checkedKeys: {
      onChangeArgsToValue: ((checkedKeys, _info) => {
        return checkedKeys;
      }) as TreeProps["onCheck"],
    },
    checkedNodes: {
      onChangeArgsToValue: ((_checkedKeys, info) => {
        return info.checkedNodes;
      }) as TreeProps["onCheck"],
    },
    checkedDetails: {
      onChangeArgsToValue: ((_checkedKeys, info) => {
        return {
          checkedNodesPositions: info.checkedNodesPositions,
          halfCheckedKeys: info.halfCheckedKeys,
        };
      }) as TreeProps["onCheck"],
    },
  },
} as const;

export const treeHelpers = treeHelpers_ as any;

export const treeData: TreeDataNode[] = [
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
}: {
  loader: Registerable | undefined;
  component: typeof AntdTree;
  name: string;
  displayName: string;
  importName: string;
  checkableDefaultValue: boolean;
  expandActionDefaultValue: string | boolean;
}) {
  registerComponentHelper(loader, component, {
    name: name,
    displayName: displayName,
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
        hidden: (ps: any) => !ps.checkable,
      },
      selectedKeys: {
        type: "array",
        editOnly: true,
        uncontrolledProp: "defaultSelectedKeys",
        description: "List of selected keys.",
        hidden: (ps: any) => !(ps.selectable ?? true),
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
            name: "info",
            type: { type: "object" },
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
        } as CheckedDetails,
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
    importName: importName,
  });
}

export function registerTree(loader?: Registerable) {
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

export function registerDirectoryTree(loader?: Registerable) {
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
