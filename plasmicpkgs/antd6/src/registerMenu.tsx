import { Menu as NativeMenu } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdMenuItem(
  props: React.ComponentProps<typeof NativeMenu.Item>,
) {
  return <>{props.children}</>;
}
export function AntdMenuDivider(
  _props: React.ComponentProps<typeof NativeMenu.Divider>,
) {
  return null;
}
export function AntdMenuItemGroup(
  props: React.ComponentProps<typeof NativeMenu.ItemGroup>,
) {
  return <>{props.children}</>;
}
export function AntdSubMenu(
  props: React.ComponentProps<typeof NativeMenu.SubMenu>,
) {
  return <>{props.children}</>;
}

export function menuChildrenToItems(
  children: React.ReactNode,
): NonNullable<React.ComponentProps<typeof NativeMenu>["items"]> {
  const result: NonNullable<React.ComponentProps<typeof NativeMenu>["items"]> =
    [];
  const visit = (nodes: React.ReactNode) =>
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      const { children: content, title, ...rest } = child.props;
      const key = child.key ?? rest.eventKey ?? String(result.length);
      if (child.type === AntdMenuItem)
        result.push({ ...rest, key, label: content });
      else if (child.type === AntdMenuDivider)
        result.push({ type: "divider", key });
      else if (child.type === AntdSubMenu || child.type === AntdMenuItemGroup) {
        result.push({
          ...rest,
          key,
          label: title,
          ...(child.type === AntdMenuItemGroup
            ? { type: "group" as const }
            : {}),
          children: menuChildrenToItems(content),
        });
      } else visit(content);
    });
  visit(children);
  return result;
}
export function AntdMenu({
  children,
  items,
  ...rest
}: React.ComponentProps<typeof NativeMenu>) {
  return (
    <NativeMenu {...rest} items={items ?? menuChildrenToItems(children)} />
  );
}

const allowedMenuComponents = [
  "plasmic-antd6-menu-item",
  "plasmic-antd6-menu-divider",
  "plasmic-antd6-submenu",
  "plasmic-antd6-menu-item-group",
];

export const MENU_ITEM_TYPE = {
  type: "object",
  nameFunc: (item: any) => {
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
        { value: "divider", label: "Menu divider" },
      ],
      defaultValue: "item",
    },
    key: {
      type: "string",
      displayName: "Menu item key",
      description:
        "Key of the menu item; the onClick will receive this as the value to indicate which item was clicked.",
      hidden: (_ps: any, _ctx: any, { item }: any) => item.type !== "item",
    },
    label: {
      type: "string",
      description: "Label of the menu item; will use the key if not specified.",
      hidden: (_ps: any, _ctx: any, { item }: any) => item.type === "divider",
    },
    children: {
      type: "array",
      displayName: "Menu items",
      hidden: (_ps: any, _ctx: any, { item }: any) =>
        item.type !== "submenu" && item.type !== "group",
    },
    onClick: {
      type: "eventHandler",
      displayName: "Action",
      description: "Action to perform when this item is selected",
      argTypes: [{ name: "info", type: "object" }],
      hidden: (_ps: any, _ctx: any, { item }: any) => item.type !== "item",
    },
  },
};
export const UNKEYED_MENU_ITEM_TYPE = {
  ...MENU_ITEM_TYPE,
  fields: Object.fromEntries(
    Object.entries(MENU_ITEM_TYPE.fields).filter(([k]) => k !== "key"),
  ),
};

(MENU_ITEM_TYPE.fields.children as any).itemType = MENU_ITEM_TYPE;
(UNKEYED_MENU_ITEM_TYPE.fields.children as any).itemType =
  UNKEYED_MENU_ITEM_TYPE;

/**
 * Note that the Menu component by itself isn't that useful.
 * It is supposed to be a stateful component, but we don't have state yet (for selected, open, etc.).
 *
 * Nor can you make it non-selectable yet and just make it be a list of clickable things.
 *
 * But we also can't get rid of it right now because it's used by Dropdown.
 *
 * Note also that we don't yet support the simpler `items` prop for configuration.
 */
export function registerMenu(loader?: Registerable) {
  registerComponentHelper(loader, AntdMenu, {
    name: "plasmic-antd6-menu",
    displayName: "Menu",
    props: {
      expandIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      mode: {
        type: "choice",
        options: ["horizontal", "vertical", "inline"],
        description: "Type of menu",
        defaultValueHint: "vertical",
      },
      multiple: {
        type: "boolean",
        description: "Allows selection of multiple items",
        defaultValueHint: false,
      },
      triggerSubMenuAction: {
        type: "choice",
        options: ["hover", "click"],
        description: "Which action can trigger submenu open/close",
        defaultValueHint: "hover",
        advanced: true,
      },
      defaultSelectedKeys: {
        type: "array",
        description:
          'An array of Menu Item/s that will be selected when this component first loads, eg ["home", "about"]. Each item in the array should be one of the unique keys set in nested Menu Item component props. Useful when using the Menu component to build a website navigation bar.',
        advanced: true,
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
            type: "component" as const,
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menuItemKey1",
            },
          },
          {
            type: "component" as const,
            name: "plasmic-antd6-menu-item",
            props: {
              key: "menuItemKey2",
            },
          },
        ],
      },
      onSelect: {
        type: "eventHandler",
        argTypes: [{ name: "key", type: "string" }],
      } as any,
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenu",
  });

  registerComponentHelper(loader, AntdMenuItem, {
    name: "plasmic-antd6-menu-item",
    displayName: "Menu Item",
    props: {
      danger: {
        type: "boolean",
        description: "Display the danger style",
        defaultValueHint: false,
      },
      disabled: {
        type: "boolean",
        description: "Whether disabled select",
        defaultValueHint: false,
      },
      key: {
        type: "string",
        displayName: "Unique key",
        description:
          "Unique ID of the menu item. Used to determine which item is selected.",
        defaultValue: "menuItemKey",
      },
      title: {
        type: "string",
        description: "Set display title for collapsed item",
      },
      children: {
        type: "slot",
        defaultValue: [
          {
            type: "text" as const,
            value: "Menu item",
          },
        ],
        ...({ mergeWithParent: true } as any),
      },
      onClick: {
        type: "eventHandler",
        argTypes: [],
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuItem",
    parentComponentName: "plasmic-antd6-menu",
  });

  registerComponentHelper(loader, AntdMenuItemGroup, {
    name: "plasmic-antd6-menu-item-group",
    displayName: "Item Group",
    props: {
      title: {
        type: "slot",
        defaultValue: [
          {
            type: "text" as const,
            value: "Group",
          },
        ],
      },
      children: {
        type: "slot",
        allowedComponents: allowedMenuComponents,
        defaultValue: [
          {
            type: "component" as const,
            name: "plasmic-antd6-menu-item",
          },
        ],
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuItemGroup",
    parentComponentName: "plasmic-antd6-menu",
  });

  registerComponentHelper(loader, AntdMenuDivider, {
    name: "plasmic-antd6-menu-divider",
    displayName: "Menu Divider",
    props: {
      dashed: {
        type: "boolean",
        description: "Whether line is dashed",
        defaultValueHint: false,
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdMenuDivider",
    parentComponentName: "plasmic-antd6-menu",
  });

  registerComponentHelper(loader, AntdSubMenu, {
    name: "plasmic-antd6-submenu",
    displayName: "Sub Menu",
    props: {
      disabled: {
        type: "boolean",
        description: "Whether sub-menu is disabled",
        defaultValueHint: false,
      },
      key: {
        type: "string",
        displayName: "Unique key",
        description:
          "Unique ID of the sub-menu. Used to determine which item is selected.",
        advanced: true,
      },
      title: {
        type: "slot",
        defaultValue: [
          {
            type: "text" as const,
            value: "Sub-menu",
          },
        ],
      },
      popupClassName: {
        type: "class",
        displayName: "Sidemenu Popup",
      },
      children: {
        type: "slot",
        allowedComponents: allowedMenuComponents,
        defaultValue: [1, 2].map((i) => ({
          type: "component" as const,
          name: "plasmic-antd6-menu-item",
          props: {
            key: `subMenuItemKey${i}`,
            children: [
              {
                type: "text" as const,
                value: `Sub-menu item ${i}`,
              },
            ],
          },
        })),
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerMenu",
    importName: "AntdSubMenu",
    parentComponentName: "plasmic-antd6-menu",
  });
}
