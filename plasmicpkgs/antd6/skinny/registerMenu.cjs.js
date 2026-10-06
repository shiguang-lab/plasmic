'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DFFF-Zj5.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdMenuItem(props) {
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, props.children);
}
function AntdMenuDivider(_props) {
  return null;
}
function AntdMenuItemGroup(props) {
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, props.children);
}
function AntdSubMenu(props) {
  return /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, props.children);
}
function menuChildrenToItems(children) {
  const result = [];
  const visit = (nodes) => React__default.default.Children.forEach(nodes, (child) => {
    if (!React__default.default.isValidElement(child)) {
      return;
    }
    const { children: content, title, ...rest } = child.props;
    const key = child.key ?? rest.eventKey ?? String(result.length);
    if (child.type === AntdMenuItem) {
      result.push({ ...rest, key, label: content });
    } else if (child.type === AntdMenuDivider) {
      result.push({ type: "divider", key });
    } else if (child.type === AntdSubMenu || child.type === AntdMenuItemGroup) {
      result.push({
        ...rest,
        key,
        label: title,
        ...child.type === AntdMenuItemGroup ? { type: "group" } : {},
        children: menuChildrenToItems(content)
      });
    } else {
      visit(content);
    }
  });
  visit(children);
  return result;
}
function AntdMenu({
  children,
  items,
  ...rest
}) {
  if (items === void 0 && React__default.default.isValidElement(children) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React__default.default.cloneElement(children, {
      children: (...args) => /* @__PURE__ */ React__default.default.createElement(AntdMenu, { ...rest }, renderChildren(...args))
    });
  }
  return /* @__PURE__ */ React__default.default.createElement(Ant.Menu, { ...rest, items: items ?? menuChildrenToItems(children) });
}
const allowedMenuComponents = [
  "plasmic-antd6-menu-item",
  "plasmic-antd6-menu-divider",
  "plasmic-antd6-submenu",
  "plasmic-antd6-menu-item-group"
];
const MENU_ITEM_TYPE = {
  type: "object",
  nameFunc: (item) => {
    if (item.type === "divider") {
      return "Divider";
    }
    return item.label || item.value;
  },
  fields: {
    type: {
      type: "choice",
      options: [
        { value: "item", label: "Menu item" },
        { value: "group", label: "Menu item group" },
        { value: "submenu", label: "Sub-menu" },
        { value: "divider", label: "Menu divider" }
      ],
      defaultValue: "item"
    },
    key: {
      type: "string",
      displayName: "Menu item key",
      description: "Key of the menu item; the onClick will receive this as the value to indicate which item was clicked.",
      hidden: (_ps, _ctx, { item }) => item.type === "divider"
    },
    label: {
      type: "string",
      description: "Label of the menu item; will use the key if not specified.",
      hidden: (_ps, _ctx, { item }) => item.type === "divider"
    },
    children: {
      type: "array",
      displayName: "Menu items",
      hidden: (_ps, _ctx, { item }) => item.type !== "submenu" && item.type !== "group"
    },
    onClick: {
      type: "eventHandler",
      displayName: "Action",
      description: "Action to perform when this item is selected",
      argTypes: [{ name: "info", type: "object" }],
      hidden: (_ps, _ctx, { item }) => item.type !== "item"
    }
  }
};
const UNKEYED_MENU_ITEM_TYPE = {
  ...MENU_ITEM_TYPE,
  fields: Object.fromEntries(
    Object.entries(MENU_ITEM_TYPE.fields).filter(([k]) => k !== "key")
  )
};
MENU_ITEM_TYPE.fields.children.itemType = MENU_ITEM_TYPE;
UNKEYED_MENU_ITEM_TYPE.fields.children.itemType = UNKEYED_MENU_ITEM_TYPE;
function registerMenu(loader) {
  utils.registerComponentHelper(loader, AntdMenu, {
    name: "plasmic-antd6-menu",
    displayName: "Menu",
    props: {
      expandIcon: {
        type: "slot",
        hidePlaceholder: true
      },
      mode: {
        type: "choice",
        options: ["horizontal", "vertical", "inline"],
        description: "Type of menu",
        defaultValueHint: "vertical"
      },
      multiple: {
        type: "boolean",
        description: "Allows selection of multiple items",
        defaultValueHint: false
      },
      triggerSubMenuAction: {
        type: "choice",
        options: ["hover", "click"],
        description: "Which action can trigger submenu open/close",
        defaultValueHint: "hover",
        advanced: true
      },
      defaultSelectedKeys: {
        type: "array",
        description: 'An array of Menu Item/s that will be selected when this component first loads, eg ["home", "about"]. Each item in the array should be one of the unique keys set in nested Menu Item component props. Useful when using the Menu component to build a website navigation bar.',
        advanced: true
      },
      //   menuScopeClassName: {
      //     type: "styleScopeClass",
      //     scopeName: "menu",
      //   } as any,
      //   menuItemClassName: {
      //     type: "class",
      //     displayName: "Menu items",
      //     noSelf: true,
      //     selectors: [
      //         {
      //             selector: ":menu .ant-menu-item",
      //             label: "Base",
      //         },
      //         {
      //             selector: ":menu .ant-menu-item-selected",
      //             label: "Selected",
      //         },
      //     ],
      //   } as any,
      children: {
        type: "slot",
        allowedComponents: allowedMenuComponents,
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menuItemKey1"
            }
          },
          {
            type: "component",
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menuItemKey2"
            }
          }
        ]
      },
      onSelect: {
        type: "eventHandler",
        argTypes: [{ name: "info", type: "object" }]
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenu"
  });
  utils.registerComponentHelper(loader, AntdMenuItem, {
    name: "plasmic-antd6-menu-item",
    displayName: "Menu Item",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      danger: {
        type: "boolean",
        description: "Display the danger style",
        defaultValueHint: false
      },
      disabled: {
        type: "boolean",
        description: "Whether disabled select",
        defaultValueHint: false
      },
      key: {
        type: "string",
        displayName: "Unique key",
        description: "Unique ID of the menu item. Used to determine which item is selected.",
        defaultValue: "menuItemKey"
      },
      title: {
        type: "string",
        description: "Set display title for collapsed item"
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Menu item"
          }
        ],
        ...{ mergeWithParent: true }
      },
      onClick: {
        type: "eventHandler",
        argTypes: []
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuItem",
    parentComponentName: "plasmic-antd6-menu"
  });
  utils.registerComponentHelper(loader, AntdMenuItemGroup, {
    name: "plasmic-antd6-menu-item-group",
    displayName: "Item Group",
    props: {
      title: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Group"
          }
        ]
      },
      children: {
        type: "slot",
        allowedComponents: allowedMenuComponents,
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-menu-item"
          }
        ]
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuItemGroup",
    parentComponentName: "plasmic-antd6-menu"
  });
  utils.registerComponentHelper(loader, AntdMenuDivider, {
    name: "plasmic-antd6-menu-divider",
    displayName: "Menu Divider",
    props: {
      dashed: {
        type: "boolean",
        description: "Whether line is dashed",
        defaultValueHint: false
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuDivider",
    parentComponentName: "plasmic-antd6-menu"
  });
  utils.registerComponentHelper(loader, AntdSubMenu, {
    name: "plasmic-antd6-submenu",
    displayName: "Sub Menu",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      disabled: {
        type: "boolean",
        description: "Whether sub-menu is disabled",
        defaultValueHint: false
      },
      key: {
        type: "string",
        displayName: "Unique key",
        description: "Unique ID of the sub-menu. Used to determine which item is selected.",
        advanced: true
      },
      title: {
        type: "slot",
        defaultValue: [
          {
            type: "text",
            value: "Sub-menu"
          }
        ]
      },
      popupClassName: {
        type: "class",
        displayName: "Sidemenu Popup"
      },
      children: {
        type: "slot",
        allowedComponents: allowedMenuComponents,
        defaultValue: [1, 2].map((i) => ({
          type: "component",
          name: "plasmic-antd6-menu-item",
          props: {
            key: `subMenuItemKey${i}`,
            children: [
              {
                type: "text",
                value: `Sub-menu item ${i}`
              }
            ]
          }
        }))
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdSubMenu",
    parentComponentName: "plasmic-antd6-menu"
  });
}

exports.AntdMenu = AntdMenu;
exports.AntdMenuDivider = AntdMenuDivider;
exports.AntdMenuItem = AntdMenuItem;
exports.AntdMenuItemGroup = AntdMenuItemGroup;
exports.AntdSubMenu = AntdSubMenu;
exports.MENU_ITEM_TYPE = MENU_ITEM_TYPE;
exports.UNKEYED_MENU_ITEM_TYPE = UNKEYED_MENU_ITEM_TYPE;
exports.menuChildrenToItems = menuChildrenToItems;
exports.registerMenu = registerMenu;
//# sourceMappingURL=registerMenu.cjs.js.map
