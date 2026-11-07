import { PlasmicCanvasProps, usePlasmicCanvasContext, usePlasmicCanvasComponentInfo } from "@plasmicapp/host";
import { ActionProps } from "@plasmicapp/host/registerComponent";
import { Tabs } from "antd";
import cls from "classnames";
import React, { ReactElement, useMemo } from "react";
import { getSelectedCanvasItemKey } from "./canvas-overlay";
import {
  Registerable,
  asArray,
  registerComponentHelper,
  traverseReactEltTree,
} from "./utils";

export const tabsComponentName = "plasmic-antd6-tabs";
export const tabItemComponentName = "plasmic-antd6-tab-item";

type TabItemType = NonNullable<
  React.ComponentProps<typeof Tabs>["items"]
>[number];

export const AntdTabItem: React.FC<TabItemType> = ({ children }) => {
  return <div>{children}</div>;
};

function getTabItems(
  items: React.ReactNode,
): React.ReactElement<TabItemType>[] {
  return asArray(items).flatMap((item) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(item)) {
      return [];
    }
    return (item.type as any)?.name === AntdTabItem.name
      ? [item as React.ReactElement<TabItemType>]
      : getTabItems(item.props.children);
  });
}

function getTabItemKeys(items: ReactElement): string[] {
  const keys: string[] = [];
  traverseReactEltTree(items, (elt) => {
    if (
      (elt?.type as any)?.name === AntdTabItem.name &&
      typeof elt?.key === "string"
    ) {
      keys.push(`${elt.key}`);
    }
  });
  return keys;
}

type TabsProps = Omit<
  React.ComponentProps<typeof Tabs>,
  "items" | "animated" | "tabBarExtraContent" | "renderTabBar"
> & PlasmicCanvasProps & {
  items: ReactElement;
  animated?: boolean;
  animateTabBar?: boolean;
  animateTabContent?: boolean;
  tabBarExtraContentLeft?: React.ReactNode;
  tabBarExtraContentRight?: React.ReactNode;
  tabsScopeClassName?: string;
  tabsDropdownScopeClassName?: string;
};

export function AntdTabs(props: TabsProps) {
  if (
    React.isValidElement<{ children: (...args: unknown[]) => React.ReactNode }>(
      props.items,
    ) &&
    typeof props.items.props.children === "function"
  ) {
    const observer = props.items;
    const renderItems = observer.props.children;
    return React.cloneElement(observer, {
      children: (...args: unknown[]) => (
        <TabsWithItems
          {...props}
          items={renderItems(...args) as ReactElement}
        />
      ),
    });
  }
  return <TabsWithItems {...props} />;
}

function TabsWithItems(props: TabsProps) {
  const canvas = usePlasmicCanvasContext();
  const state = usePlasmicCanvasComponentInfo(props)?.states?.activeKey;
  const isEditing = !!canvas && !canvas.interactive;
  const {
    items: itemsRaw,
    animated = true,
    animateTabBar = true,
    animateTabContent = false,
    tabBarExtraContentLeft,
    tabBarExtraContentRight,
    className,
    classNames,
    tabPlacement,
    tabsScopeClassName,
    tabsDropdownScopeClassName,
    __canvas: _canvas,
    ...rest
  } = props;
  const animationProp: React.ComponentProps<typeof Tabs>["animated"] = useMemo(
    () =>
      animated
        ? {
            inkBar: animateTabBar,
            tabPane: animateTabContent,
          }
        : false,
    [animateTabBar, animateTabContent, animated],
  );
  const tabItems = getTabItems(itemsRaw);
  const selectedKey = isEditing
    ? getSelectedCanvasItemKey(tabItems)
    : undefined;
  const items: TabItemType[] = tabItems
    .map((currentItem) => {
      const { __canvas: _canvas, ...itemProps } = currentItem.props as TabItemType & PlasmicCanvasProps;
      return {
        ...itemProps,
        key: currentItem.key,
        children: <>{currentItem.props?.children}</>,
      };
    })
    .filter((i) => i != null) as TabItemType[];
  const initialActiveKey = rest.activeKey ?? rest.defaultActiveKey;
  const activeKey = selectedKey !== undefined && state
    ? state.reveal(String(selectedKey)) as string | undefined
    : rest.activeKey;

  return (
    <Tabs
      className={cls(className, tabsScopeClassName)}
      classNames={(info) => {
        const names =
          typeof classNames === "function" ? classNames(info) : classNames;
        const popup =
          typeof names?.popup === "string"
            ? { root: names.popup }
            : names?.popup;
        return {
          ...names,
          popup: {
            ...popup,
            root: cls(popup?.root, tabsDropdownScopeClassName),
          },
        };
      }}
      tabBarExtraContent={
        tabBarExtraContentLeft != null || tabBarExtraContentRight != null
          ? { left: tabBarExtraContentLeft, right: tabBarExtraContentRight }
          : undefined
      }
      tabPlacement={tabPlacement}
      animated={animationProp}
      items={items}
      {...rest}
      activeKey={
        isEditing
          ? String(
              activeKey ?? selectedKey ??
                initialActiveKey ??
                items.find((item) => !item.disabled)?.key ??
                "",
            )
          : activeKey
      }
      onChange={state || !isEditing ? rest.onChange : undefined}
      onTabClick={isEditing ? undefined : rest.onTabClick}
      onTabScroll={isEditing ? undefined : rest.onTabScroll}
    />
  );
}

function OutlineMessage() {
  return <div>Drag tabs in the outline to reorder them</div>;
}

export function registerTabs(loader?: Registerable) {
  registerComponentHelper(loader, AntdTabs, {
    description: "Switch between named content panels within the same page, keeping the selected tab and visible panel synchronized. Use Tab Item children or configured items; this is content navigation, not selection of a form value.",
    name: tabsComponentName,
    displayName: "Tabs",
    defaultStyles: {
      width: "stretch",
    },
    props: {
      addIcon: { type: "slot", hidePlaceholder: true },
      removeIcon: { type: "slot", hidePlaceholder: true },
      activeKey: {
        displayName: "Active tab key",
        type: "choice",
        description:
          "The controlled active tab key. Bind to state and update it in onChange to allow switching. Takes precedence over defaultActiveKey.",
        options: (ps: any) =>
          ps.items === undefined ? undefined : getTabItemKeys(ps.items),
      },
      defaultActiveKey: {
        displayName: "Default active tab key",
        type: "choice",
        description:
          "The initially active tab key when activeKey is not set. Temporary canvas reveals do not change this value.",
        options: (ps: any) =>
          ps.items === undefined ? undefined : getTabItemKeys(ps.items),
      },
      animated: {
        type: "boolean",
        defaultValue: true,
        description: "Change tabs with animation",
      },
      animateTabBar: {
        type: "boolean",
        defaultValue: true,
        description: "Animate the tab bar when switching tabs",
        hidden: (ps: any) => !ps.animated,
      },
      animateTabContent: {
        type: "boolean",
        defaultValue: false,
        description: "Fade-in tab content when switching tabs",
        hidden: (ps: any) => !ps.animated,
      },
      centered: {
        type: "boolean",
        description: "Center-align the tab bar",
      },
      type: {
        type: "choice",
        defaultValueHint: "line",
        options: ["line", "card"],
        description: "Basic style of tabs",
      },
      items: {
        type: "slot",
        displayName: "Tabs",
        hidePlaceholder: true,
        allowedComponents: [tabItemComponentName],
        ...({ mergeWithParent: true } as any), // to make the tab items selectable from the components outline pane in Plasmic Studio.
        defaultValue: [
          {
            type: "component",
            name: tabItemComponentName,
            props: {
              key: "1",
              label: {
                type: "text",
                value: "First Item",
              },
              children: {
                type: "text",
                value: "First Children",
              },
            },
          },
          {
            type: "component",
            name: tabItemComponentName,
            props: {
              key: "2",
              label: {
                type: "text",
                value: "Second Item",
              },
              children: {
                type: "text",
                value: "Second Children",
              },
            },
          },
        ],
      },
      size: {
        type: "choice",
        defaultValueHint: "medium",
        options: ["large", "medium", "small"],
        description: "Preset tab bar size",
      },
      tabBarExtraContentLeft: {
        type: "slot",
        displayName: "Extra content on left side",
        hidePlaceholder: true,
      },
      tabBarExtraContentRight: {
        type: "slot",
        displayName: "Extra content on right side",
        hidePlaceholder: true,
      },
      tabBarGutter: {
        type: "number",
        displayName: "Tab gap",
        description: "Gap (in pixels) between tabs",
        advanced: true,
      },
      tabPlacement: {
        type: "choice",
        defaultValueHint: "top",
        options: ["top", "right", "bottom", "left"],
        description: "Position of tabs",
      },
      destroyOnHidden: {
        type: "boolean",
        description: `Destroy/Unmount inactive tab pane when changing tab`,
        advanced: true,
      },
      tabsScopeClassName: {
        type: "styleScopeClass",
        scopeName: "tabs",
      } as any,
      tabBarClassName: {
        type: "class",
        displayName: "Tab bar",
        selectors: [
          {
            selector: ":tabs.ant-tabs .ant-tabs-nav",
            label: "Base",
          },
        ],
      },
      tabsDropdownScopeClassName: {
        type: "styleScopeClass",
        scopeName: "tabsDropdown",
      } as any,
      tabsDropdownClassName: {
        type: "class",
        displayName: "Overflow tabs menu",
        selectors: [
          {
            selector: ":tabsDropdown.ant-tabs-dropdown .ant-tabs-dropdown-menu",
            label: "Base",
          },
        ],
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "activeKey", type: "string" }],
      },
      onTabClick: {
        type: "eventHandler",
        advanced: true,
        argTypes: [
          { name: "tabKey", type: "string" },
          { name: "mouseEvent", type: "object" },
        ],
      },
      onTabScroll: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "scrollInfo", type: "object" }],
      },
    },
    states: {
      activeKey: {
        type: "writable",
        valueProp: "activeKey",
        onChangeProp: "onChange",
        initialValueProp: "defaultActiveKey",
        variableType: "text",
      },
    },
    actions: [
      {
        type: "button-action",
        label: "Add tab",
        onClick: ({ componentProps, studioOps }: ActionProps<any>) => {
          // Get the first positive integer that isn't already a key
          const generateNewKey = () => {
            const existingKeys = getTabItemKeys(componentProps.items);

            for (
              let keyCandidate = 1;
              keyCandidate <= existingKeys.length + 1;
              keyCandidate++
            ) {
              const strKey = keyCandidate.toString();
              const index = existingKeys.findIndex((k) => {
                return strKey === k;
              });
              if (index === -1) {
                return strKey;
              }
            }

            return undefined;
          };

          const tabKey = generateNewKey();
          studioOps.appendToSlot(
            {
              type: "component",
              name: tabItemComponentName,
              props: {
                key: tabKey,
                label: {
                  type: "text",
                  value: `Tab Label ${tabKey}`,
                },
                children: {
                  type: "text",
                  value: `Tab Children ${tabKey}`,
                },
              },
            },
            "items",
          );
          studioOps.updateProps({ defaultActiveKey: tabKey });
        },
      },
      {
        type: "button-action",
        label: "Delete current tab",
        onClick: ({ componentProps, studioOps }: ActionProps<any>) => {
          const tabPanes = getTabItemKeys(componentProps.items);
          const activeKey =
            componentProps.activeKey ??
            componentProps.defaultActiveKey ??
            getTabItems(componentProps.items).find(
              (item) => !item.props.disabled,
            )?.key;
          const currTabPos = tabPanes.findIndex((tabKey) => {
            return tabKey === activeKey;
          });

          if (currTabPos !== -1) {
            studioOps.removeFromSlotAt(currTabPos, "items");
            const remaining = tabPanes.filter(
              (_, index) => index !== currTabPos,
            );
            studioOps.updateProps({
              defaultActiveKey: remaining[Math.max(0, currTabPos - 1)],
            });
          }
        },
      },
      {
        type: "custom-action",
        control: OutlineMessage,
      },
    ],
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTabs",
    importName: "AntdTabs",
  });

  registerComponentHelper(loader, AntdTabItem, {
    description: "One labeled content panel inside Tabs. Its key identifies the active panel; place panel content in its children slot.",
    name: tabItemComponentName,
    displayName: "Tab Item",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      closeIcon: { type: "slot", hidePlaceholder: true },
      disabled: {
        type: "boolean",
        description: "Disable this tab",
      },
      forceRender: {
        type: "boolean",
        description: `Force render of content in the tab, not lazy render after clicking on the tab`,
        advanced: true,
      },
      key: {
        type: "string",
        description: `Unique identifier for this tab`,
        displayName: "Key",
      },
      label: {
        type: "slot",
        displayName: "Label",
        defaultValue: "Tab",
      },
      children: {
        type: "slot",
        displayName: "Content",
        hidePlaceholder: true,
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTabs",
    importName: "AntdTabItem",
    parentComponentName: tabsComponentName,
  });
}
