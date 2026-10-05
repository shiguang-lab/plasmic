"use strict";

var Ant = require("antd");
var React = require("react");
var canvasOverlay = require("./canvas-overlay-S34meFm4.cjs.js");
var registerMenu = require("./registerMenu.cjs.js");
var utils = require("./utils-CRCm44nj.cjs.js");
require("@plasmicapp/host");
require("@plasmicapp/host/registerComponent");
require("@plasmicapp/host/registerGlobalContext");

function _interopDefault(e) {
  return e && e.__esModule ? e : { default: e };
}

var React__default = /*#__PURE__*/ _interopDefault(React);

function addKeysToUnkeyedMenuItems(unkeyedMenuItems, maybeGenKey) {
  const genKey =
    maybeGenKey ??
    /* @__PURE__ */ (() => {
      let key = 0;
      return () => {
        return `${key++}`;
      };
    })();
  return unkeyedMenuItems?.map((item) => {
    if (!item) {
      return null;
    }
    const newItem = { ...item };
    if (!newItem.key) {
      newItem.key = genKey();
    }
    if ("children" in newItem && newItem.children) {
      newItem.children = addKeysToUnkeyedMenuItems(newItem.children, genKey);
    }
    return newItem;
  });
}
function AntdDropdown(props) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = canvasOverlay.useCanvasOverlay(props, "children");
  const {
    children,
    onAction,
    menuItems,
    useMenuItemsSlot = false,
    menuItemsJson: unkeyedMenuItems,
    trigger = "hover",
    dropdownMenuScopeClassName,
    ...rest
  } = canvasProps;
  const keyedMenuItems = addKeysToUnkeyedMenuItems(unkeyedMenuItems);
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Dropdown,
    {
      ...rest,
      open,
      destroyOnHidden: isEditing ? true : props.destroyOnHidden,
      onOpenChange: isEditing ? void 0 : props.onOpenChange,
      trigger: [trigger],
      popupRender: () => {
        const itemsChildren = useMenuItemsSlot ? (menuItems?.() ?? []) : void 0;
        const items = useMenuItemsSlot ? void 0 : keyedMenuItems;
        return /* @__PURE__ */ React__default.default.createElement(
          registerMenu.AntdMenu,
          {
            className: `${dropdownMenuScopeClassName}`,
            onClick: isEditing ? void 0 : (event) => onAction?.(event.key),
            items,
          },
          itemsChildren,
        );
      },
    },
    typeof children === "string"
      ? /* @__PURE__ */ React__default.default.createElement(
          "div",
          null,
          children,
        )
      : children,
  );
}
function registerDropdown(loader) {
  utils.registerComponentHelper(loader, AntdDropdown, {
    name: "plasmic-antd6-dropdown",
    displayName: "Dropdown",
    props: {
      previewOpen: canvasOverlay.previewOpenProp,
      menuItems: {
        type: "slot",
        displayName: "Menu items",
        hidden: (ps) => !ps.useMenuItemsSlot,
        allowedComponents: [
          "plasmic-antd6-menu-item",
          "plasmic-antd6-menu-item-group",
          "plasmic-antd6-menu-divider",
          "plasmic-antd6-submenu",
        ],
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menu-item-1",
            },
          },
          {
            type: "component",
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menu-item-2",
            },
          },
        ],
        renderPropParams: [],
      },
      menuItemsJson: {
        type: "array",
        displayName: "Menu Items",
        hidden: (ps) => !!ps.useMenuItemsSlot,
        itemType: registerMenu.UNKEYED_MENU_ITEM_TYPE,
        defaultValue: [
          {
            type: "item",
            value: "action1",
            label: "Action 1",
          },
          {
            type: "item",
            value: "action2",
            label: "Action 2",
          },
        ],
      },
      dropdownMenuScopeClassName: {
        type: "styleScopeClass",
        scopeName: "dropdownMenu",
      },
      menuClassName: {
        type: "class",
        displayName: "Menu",
        selectors: [
          {
            selector: ":dropdownMenu.ant-dropdown-menu",
            label: "Base",
          },
        ],
      },
      menuItemClassName: {
        type: "class",
        displayName: "Menu item",
        selectors: [
          {
            selector: ":dropdownMenu.ant-dropdown-menu .ant-dropdown-menu-item",
            label: "Base",
          },
          {
            selector:
              ":dropdownMenu.ant-dropdown-menu .ant-dropdown-menu-item-active",
            label: "Focused",
          },
        ],
      },
      open: {
        type: "boolean",
        description: "Toggle visibility of dropdown menu in Plasmic Editor",
        editOnly: true,
        uncontrolledProp: "fakeOpen",
        defaultValueHint: false,
      },
      disabled: {
        type: "boolean",
        description: "Whether the dropdown menu is disabled",
        defaultValueHint: false,
      },
      placement: {
        type: "choice",
        options: [
          "bottomLeft",
          "bottom",
          "bottomRight",
          "topLeft",
          "top",
          "topRight",
        ],
        description: "Placement of popup menu",
        defaultValueHint: "bottomLeft",
        advanced: true,
      },
      trigger: {
        type: "choice",
        options: [
          { value: "click", label: "Click" },
          { value: "hover", label: "Hover" },
          { value: "contextMenu", label: "Right-click" },
        ],
        description: "The trigger mode which executes the dropdown action",
        defaultValueHint: "hover",
      },
      useMenuItemsSlot: {
        type: "boolean",
        displayName: "Use menu items slot",
        advanced: true,
        description:
          "Instead of configuring a list of menu items, build the menu items using MenuItem elements. This gives you greater control over item styling.",
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "component",
            name: "plasmic-antd6-button",
            props: {
              children: {
                type: "text",
                value: "Dropdown",
              },
            },
          },
        ],
        ...{ mergeWithParent: true },
      },
      onAction: {
        type: "eventHandler",
        argTypes: [{ name: "key", type: "string" }],
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDropdown",
    importName: "AntdDropdown",
  });
}

exports.AntdDropdown = AntdDropdown;
exports.registerDropdown = registerDropdown;
//# sourceMappingURL=registerDropdown.cjs.js.map
