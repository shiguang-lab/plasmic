'use strict';

var host = require('@plasmicapp/host');
var Ant = require('antd');
var cls = require('classnames');
var React = require('react');
var canvasOverlay = require('./canvas-overlay-BCQmyJjQ.cjs.js');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cls__default = /*#__PURE__*/_interopDefault(cls);
var React__default = /*#__PURE__*/_interopDefault(React);

const tabsComponentName = "plasmic-antd6-tabs";
const tabItemComponentName = "plasmic-antd6-tab-item";
const AntdTabItem = ({ children }) => {
  return /* @__PURE__ */ React__default.default.createElement("div", null, children);
};
function getTabItems(items) {
  return utils.asArray(items).flatMap((item) => {
    if (!React__default.default.isValidElement(item)) return [];
    return item.type?.name === AntdTabItem.name ? [item] : getTabItems(item.props.children);
  });
}
function getTabItemKeys(items) {
  const keys = [];
  utils.traverseReactEltTree(items, (elt) => {
    if (elt?.type?.name === AntdTabItem.name && typeof elt?.key === "string") {
      keys.push(`${elt.key}`);
    }
  });
  return keys;
}
function AntdTabs(props) {
  if (React__default.default.isValidElement(
    props.items
  ) && typeof props.items.props.children === "function") {
    const observer = props.items;
    const renderItems = observer.props.children;
    return React__default.default.cloneElement(observer, {
      children: (...args) => /* @__PURE__ */ React__default.default.createElement(
        TabsWithItems,
        {
          ...props,
          items: renderItems(...args)
        }
      )
    });
  }
  return /* @__PURE__ */ React__default.default.createElement(TabsWithItems, { ...props });
}
function TabsWithItems(props) {
  const canvas = host.usePlasmicCanvasContext();
  const isEditing = !!canvas && !canvas.interactive;
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
  const animationProp = React.useMemo(
    () => animated ? {
      inkBar: animateTabBar,
      tabPane: animateTabContent
    } : false,
    [animateTabBar, animateTabContent, animated]
  );
  const tabItems = getTabItems(itemsRaw);
  const selectedKey = isEditing ? canvasOverlay.getSelectedCanvasItemKey(tabItems) : void 0;
  const items = tabItems.map((currentItem) => {
    return {
      ...currentItem.props,
      key: currentItem.key,
      children: /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, currentItem.props?.children)
    };
  }).filter((i) => i != null);
  const initialActiveKey = rest.activeKey ?? rest.defaultActiveKey;
  const [canvasTab, setCanvasTab] = React.useState();
  React.useEffect(() => {
    if (!isEditing) {
      setCanvasTab(void 0);
    } else if (selectedKey !== void 0) {
      setCanvasTab({ key: String(selectedKey), initialActiveKey });
    } else {
      setCanvasTab(
        (tab) => tab?.initialActiveKey === initialActiveKey ? tab : void 0
      );
    }
  }, [isEditing, selectedKey, initialActiveKey]);
  const retainedKey = canvasTab?.initialActiveKey === initialActiveKey && items.some((item) => item.key === canvasTab?.key) ? canvasTab?.key : void 0;
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Tabs,
    {
      key: isEditing ? "canvas" : "runtime",
      className: cls__default.default(className, tabsScopeClassName),
      classNames: (info) => {
        const names = typeof classNames === "function" ? classNames(info) : classNames;
        const popup = typeof names?.popup === "string" ? { root: names.popup } : names?.popup;
        return {
          ...names,
          popup: {
            ...popup,
            root: cls__default.default(popup?.root, tabsDropdownScopeClassName)
          }
        };
      },
      tabBarExtraContent: {
        left: /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, tabBarExtraContentLeft),
        right: /* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, tabBarExtraContentRight)
      },
      tabPlacement,
      renderTabBar: sticky && tabPlacement === "top" ? (tabBarProps, DefaultTabBar) => /* @__PURE__ */ React__default.default.createElement(
        "div",
        {
          style: {
            zIndex: 1,
            position: "sticky",
            top: stickyOffset || 0
          }
        },
        /* @__PURE__ */ React__default.default.createElement(
          DefaultTabBar,
          {
            ...tabBarProps,
            style: { backgroundColor: tabBarBackground }
          }
        )
      ) : void 0,
      animated: animationProp,
      items,
      ...rest,
      activeKey: isEditing ? String(
        selectedKey ?? retainedKey ?? initialActiveKey ?? items.find((item) => !item.disabled)?.key ?? ""
      ) : rest.activeKey,
      onChange: isEditing ? (key) => setCanvasTab({ key, initialActiveKey }) : rest.onChange,
      onTabClick: isEditing ? void 0 : rest.onTabClick,
      onTabScroll: isEditing ? void 0 : rest.onTabScroll
    }
  );
}
function OutlineMessage() {
  return /* @__PURE__ */ React__default.default.createElement("div", null, "Drag tabs in the outline to reorder them");
}
function registerTabs(loader) {
  utils.registerComponentHelper(loader, AntdTabs, {
    name: tabsComponentName,
    displayName: "Tabs",
    defaultStyles: {
      width: "stretch",
      overflow: "scroll"
    },
    props: {
      addIcon: { type: "slot", hidePlaceholder: true },
      removeIcon: { type: "slot", hidePlaceholder: true },
      activeKey: {
        editOnly: true,
        displayName: "Active tab key",
        uncontrolledProp: "defaultActiveKey",
        type: "choice",
        description: "The initially active tab key. Temporary canvas reveals do not change this value.",
        options: (ps) => getTabItemKeys(ps.items)
      },
      animated: {
        type: "boolean",
        defaultValue: true,
        description: "Change tabs with animation"
      },
      animateTabBar: {
        type: "boolean",
        defaultValue: true,
        description: "Animate the tab bar when switching tabs",
        hidden: (ps) => !ps.animated
      },
      animateTabContent: {
        type: "boolean",
        defaultValue: false,
        description: "Fade-in tab content when switching tabs",
        hidden: (ps) => !ps.animated
      },
      centered: {
        type: "boolean",
        description: "Center-align the tab bar"
      },
      type: {
        type: "choice",
        defaultValueHint: "line",
        options: ["line", "card"],
        description: "Basic style of tabs"
      },
      items: {
        type: "slot",
        displayName: "Tabs",
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
                value: "First Item"
              },
              children: {
                type: "text",
                value: "First Children"
              }
            }
          },
          {
            type: "component",
            name: tabItemComponentName,
            props: {
              key: "2",
              label: {
                type: "text",
                value: "Second Item"
              },
              children: {
                type: "text",
                value: "Second Children"
              }
            }
          }
        ]
      },
      size: {
        type: "choice",
        defaultValueHint: "medium",
        options: ["large", "medium", "small"],
        description: "Preset tab bar size"
      },
      tabBarExtraContentLeft: {
        type: "slot",
        displayName: "Extra content on left side",
        hidePlaceholder: true
      },
      tabBarExtraContentRight: {
        type: "slot",
        displayName: "Extra content on right side",
        hidePlaceholder: true
      },
      tabBarGutter: {
        type: "number",
        displayName: "Tab gap",
        description: "Gap (in pixels) between tabs",
        advanced: true
      },
      tabPlacement: {
        type: "choice",
        defaultValueHint: "top",
        options: ["top", "right", "bottom", "left"],
        description: "Position of tabs"
      },
      destroyOnHidden: {
        type: "boolean",
        description: `Destroy/Unmount inactive tab pane when changing tab`,
        advanced: true
      },
      sticky: {
        type: "boolean",
        advanced: true,
        description: "Stick tab bar to the top of the page when scrolling.",
        defaultValue: false,
        hidden: (ps) => ps.tabPlacement !== "top"
      },
      stickyOffset: {
        type: "number",
        advanced: true,
        description: "Distance (in pixels) between the sticky tab bar and the top of the page as you scroll.",
        hidden: (ps) => ps.tabPlacement !== "top" || !ps.sticky
      },
      tabBarBackground: {
        type: "color",
        advanced: true,
        defaultValue: "#FFF",
        hidden: (ps) => ps.tabPlacement !== "top" || !ps.sticky
      },
      tabsScopeClassName: {
        type: "styleScopeClass",
        scopeName: "tabs"
      },
      tabBarClassName: {
        type: "class",
        displayName: "Tab bar",
        selectors: [
          {
            selector: ":tabs.ant-tabs .ant-tabs-nav",
            label: "Base"
          }
        ]
      },
      tabsDropdownScopeClassName: {
        type: "styleScopeClass",
        scopeName: "tabsDropdown"
      },
      tabsDropdownClassName: {
        type: "class",
        displayName: "Overflow tabs menu",
        selectors: [
          {
            selector: ":tabsDropdown.ant-tabs-dropdown .ant-tabs-dropdown-menu",
            label: "Base"
          }
        ]
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "activeKey", type: "string" }]
      },
      onTabClick: {
        type: "eventHandler",
        advanced: true,
        argTypes: [
          { name: "tabKey", type: "string" },
          { name: "mouseEvent", type: "object" }
        ]
      },
      onTabScroll: {
        type: "eventHandler",
        advanced: true,
        argTypes: [{ name: "scrollInfo", type: "object" }]
      }
    },
    states: {
      activeKey: {
        type: "writable",
        valueProp: "activeKey",
        onChangeProp: "onChange",
        variableType: "text"
      }
    },
    actions: [
      {
        type: "button-action",
        label: "Add tab",
        onClick: ({ componentProps, studioOps }) => {
          const generateNewKey = () => {
            const existingKeys = getTabItemKeys(componentProps.items);
            for (let keyCandidate = 1; keyCandidate <= existingKeys.length + 1; keyCandidate++) {
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
                  value: `Tab Label ${tabKey}`
                },
                children: {
                  type: "text",
                  value: `Tab Children ${tabKey}`
                }
              }
            },
            "items"
          );
          studioOps.updateProps({ activeKey: tabKey });
        }
      },
      {
        type: "button-action",
        label: "Delete current tab",
        onClick: ({ componentProps, studioOps }) => {
          const tabPanes = getTabItemKeys(componentProps.items);
          const activeKey = componentProps.activeKey ?? componentProps.defaultActiveKey ?? getTabItems(componentProps.items).find(
            (item) => !item.props.disabled
          )?.key;
          const currTabPos = tabPanes.findIndex((tabKey) => {
            return tabKey === activeKey;
          });
          if (currTabPos !== -1) {
            studioOps.removeFromSlotAt(currTabPos, "items");
            const remaining = tabPanes.filter(
              (_, index) => index !== currTabPos
            );
            studioOps.updateProps({
              activeKey: remaining[Math.max(0, currTabPos - 1)]
            });
          }
        }
      },
      {
        type: "custom-action",
        control: OutlineMessage
      }
    ],
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTabs",
    importName: "AntdTabs"
  });
  utils.registerComponentHelper(loader, AntdTabItem, {
    name: tabItemComponentName,
    displayName: "Tab Item",
    props: {
      icon: { type: "slot", hidePlaceholder: true },
      closeIcon: { type: "slot", hidePlaceholder: true },
      disabled: {
        type: "boolean",
        description: "Disable this tab"
      },
      forceRender: {
        type: "boolean",
        description: `Force render of content in the tab, not lazy render after clicking on the tab`,
        advanced: true
      },
      key: {
        type: "string",
        description: `Unique identifier for this tab`,
        displayName: "Key"
      },
      label: {
        type: "slot",
        displayName: "Label",
        defaultValue: "Tab"
      },
      children: {
        type: "slot",
        displayName: "Content",
        hidePlaceholder: true
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerTabs",
    importName: "AntdTabItem",
    parentComponentName: tabsComponentName
  });
}

exports.AntdTabItem = AntdTabItem;
exports.AntdTabs = AntdTabs;
exports.registerTabs = registerTabs;
exports.tabItemComponentName = tabItemComponentName;
exports.tabsComponentName = tabsComponentName;
//# sourceMappingURL=registerTabs.cjs.js.map
