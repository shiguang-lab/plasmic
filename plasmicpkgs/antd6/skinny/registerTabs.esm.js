import "@plasmicapp/host/registerComponent";
import "@plasmicapp/host/registerGlobalContext";
import { Tabs } from "antd";
import cls from "classnames";
import React, { useMemo } from "react";
import {
  b as asArray,
  r as registerComponentHelper,
  t as traverseReactEltTree,
} from "./utils-CSvRw6Za.esm.js";

const tabsComponentName = "plasmic-antd6-tabs";
const tabItemComponentName = "plasmic-antd6-tab-item";
const AntdTabItem = ({ children }) => {
  return /* @__PURE__ */ React.createElement("div", null, children);
};
function getTabItems(items) {
  if (!items) {
    return [];
  }
  if (!React.isValidElement(items) && Array.isArray(items)) return [...items];
  return items?.type?.name == AntdTabItem.name
    ? [items]
    : asArray(items.props?.children).flat(1).filter(React.isValidElement);
}
function getTabItemKeys(items) {
  const keys = [];
  traverseReactEltTree(items, (elt) => {
    if (elt?.type?.name === AntdTabItem.name && typeof elt?.key === "string") {
      keys.push(`${elt.key}`);
    }
  });
  return keys;
}
function AntdTabs(props) {
  const {
    items: itemsRaw,
    animated = true,
    animateTabBar = true,
    animateTabContent = false,
    tabBarExtraContentLeft,
    tabBarExtraContentRight,
    sticky,
    stickyOffset,
    tabBarBackground,
    className,
    classNames,
    tabPlacement,
    tabsScopeClassName,
    tabsDropdownScopeClassName,
    ...rest
  } = props;
  const animationProp = useMemo(
    () =>
      animated
        ? {
            inkBar: animateTabBar,
            tabPane: animateTabContent,
          }
        : false,
    [animateTabBar, animateTabContent, animated],
  );
  const items = useMemo(() => {
    const tabItems = getTabItems(itemsRaw);
    return tabItems
      .map((currentItem) => {
        return {
          ...currentItem.props,
          key: currentItem.key,
          children: /* @__PURE__ */ React.createElement(
            React.Fragment,
            null,
            currentItem.props?.children,
          ),
        };
      })
      .filter((i) => i != null);
  }, [itemsRaw]);
  return /* @__PURE__ */ React.createElement(Tabs, {
    className: cls(className, tabsScopeClassName),
    classNames: (info) => {
      const names =
        typeof classNames === "function" ? classNames(info) : classNames;
      const popup =
        typeof names?.popup === "string" ? { root: names.popup } : names?.popup;
      return {
        ...names,
        popup: { ...popup, root: cls(popup?.root, tabsDropdownScopeClassName) },
      };
    },
    tabBarExtraContent: {
      left: /* @__PURE__ */ React.createElement(
        React.Fragment,
        null,
        tabBarExtraContentLeft,
      ),
      right: /* @__PURE__ */ React.createElement(
        React.Fragment,
        null,
        tabBarExtraContentRight,
      ),
    },
    tabPlacement,
    renderTabBar:
      sticky && tabPlacement === "top"
        ? (tabBarProps, DefaultTabBar) =>
            /* @__PURE__ */ React.createElement(
              "div",
              {
                style: {
                  zIndex: 1,
                  position: "sticky",
                  top: stickyOffset || 0,
                },
              },
              /* @__PURE__ */ React.createElement(DefaultTabBar, {
                ...tabBarProps,
                style: { backgroundColor: tabBarBackground },
              }),
            )
        : void 0,
    animated: animationProp,
    items,
    ...rest,
  });
}
function OutlineMessage() {
  return /* @__PURE__ */ React.createElement(
    "div",
    null,
    "* To re-arrange tab panes, use the Outline panel",
  );
}
function registerTabs(loader) {
  registerComponentHelper(loader, AntdTabs, {
    name: tabsComponentName,
    displayName: "Tabs",
    defaultStyles: {
      width: "stretch",
      overflow: "scroll",
    },
    props: {
      addIcon: { type: "slot", hidePlaceholder: true },
      removeIcon: { type: "slot", hidePlaceholder: true },
      activeKey: {
        editOnly: true,
        displayName: "Active tab key",
        uncontrolledProp: "defaultActiveKey",
        type: "choice",
        description: `Initial active tab's key`,
        options: (ps) => getTabItemKeys(ps.items),
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
        hidden: (ps) => !ps.animated,
      },
      animateTabContent: {
        type: "boolean",
        defaultValue: false,
        description: "Fade-in tab content when switching tabs",
        hidden: (ps) => !ps.animated,
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
        hidePlaceholder: true,
        allowedComponents: [tabItemComponentName],
        ...{ mergeWithParent: true },
        // to make the tab items selectable from the components outline pane in Plasmic Studio.
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
      sticky: {
        type: "boolean",
        advanced: true,
        description: "Stick tab bar to the top of the page when scrolling.",
        defaultValue: false,
        hidden: (ps) => ps.tabPlacement !== "top",
      },
      stickyOffset: {
        type: "number",
        advanced: true,
        description:
          "Distance (in pixels) between the sticky tab bar and the top of the page as you scroll.",
        hidden: (ps) => ps.tabPlacement !== "top" || !ps.sticky,
      },
      tabBarBackground: {
        type: "color",
        advanced: true,
        defaultValue: "#FFF",
        hidden: (ps) => ps.tabPlacement !== "top" || !ps.sticky,
      },
      tabsScopeClassName: {
        type: "styleScopeClass",
        scopeName: "tabs",
      },
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
      },
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
        variableType: "text",
      },
    },
    actions: [
      // {
      //   type: "custom-action",
      //   control: NavigateTabs,
      // },
      {
        type: "button-action",
        label: "Add new tab",
        onClick: ({ componentProps, studioOps }) => {
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
            return void 0;
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
          studioOps.updateProps({ activeKey: tabKey });
        },
      },
      {
        type: "button-action",
        label: "Delete current tab",
        onClick: ({ componentProps, studioOps }) => {
          if (componentProps.activeKey) {
            const tabPanes = getTabItemKeys(componentProps.items);
            const activeKey = componentProps.activeKey;
            const currTabPos = tabPanes.findIndex((tabKey) => {
              return tabKey === activeKey;
            });
            if (currTabPos !== -1) {
              studioOps.removeFromSlotAt(currTabPos, "items");
              if (tabPanes.length - 1 > 0) {
                const prevTabPos =
                  (currTabPos - 1 + tabPanes.length) % tabPanes.length;
                studioOps.updateProps({ activeKey: tabPanes[prevTabPos] });
              }
            }
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
        displayName: "Tab key",
      },
      label: {
        type: "slot",
        displayName: "Tab title",
        defaultValue: "Tab",
      },
      children: {
        type: "slot",
        hidePlaceholder: true,
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTabs",
    importName: "AntdTabItem",
    parentComponentName: tabsComponentName,
  });
}

export {
  AntdTabItem,
  AntdTabs,
  registerTabs,
  tabItemComponentName,
  tabsComponentName,
};
//# sourceMappingURL=registerTabs.esm.js.map
