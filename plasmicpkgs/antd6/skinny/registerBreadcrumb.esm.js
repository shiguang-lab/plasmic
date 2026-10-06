import { Breadcrumb } from 'antd';
import React from 'react';
import { b as asArray, r as registerComponentHelper } from './utils-z8_Paxbd.esm.js';
import '@plasmicapp/host/registerComponent';
import '@plasmicapp/host/registerGlobalContext';

function AntdBreadcrumbItem(props) {
  return props.children;
}
function AntdBreadcrumb(props) {
  const { itemsRaw, items: configuredItems, ...rest } = props;
  const items = React.useMemo(() => {
    const children = React.isValidElement(itemsRaw) && itemsRaw.type !== AntdBreadcrumbItem ? itemsRaw.props.children : itemsRaw;
    return asArray(children).flat(1).filter(React.isValidElement).map((currentItem) => {
      return {
        ...currentItem.props,
        title: React.cloneElement(/* @__PURE__ */ React.createElement(React.Fragment, null, currentItem))
      };
    });
  }, [itemsRaw]);
  return /* @__PURE__ */ React.createElement(
    Breadcrumb,
    {
      ...rest,
      items: itemsRaw === void 0 ? configuredItems : items
    }
  );
}
const breadcrumbItemComponentName = "plasmic-antd6-breadcrumb-item";
const breadcrumbComponentName = "plasmic-antd6-breadcrumb";
function registerBreadcrumb(loader) {
  registerComponentHelper(loader, AntdBreadcrumb, {
    name: breadcrumbComponentName,
    displayName: "Breadcrumb",
    props: {
      itemsRaw: {
        type: "slot",
        displayName: "items",
        defaultValue: [
          {
            type: "component",
            name: breadcrumbItemComponentName,
            props: {
              children: {
                type: "text",
                value: "First"
              }
            }
          },
          {
            type: "component",
            name: breadcrumbItemComponentName,
            props: {
              children: {
                type: "text",
                value: "Second"
              }
            }
          },
          {
            type: "component",
            name: breadcrumbItemComponentName,
            props: {
              children: {
                type: "text",
                value: "Third"
              }
            }
          }
        ],
        allowedComponents: [breadcrumbItemComponentName]
      },
      separator: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "/"
        }
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerBreadcrumb",
    importName: "AntdBreadcrumb"
  });
}
function registerBreadcrumbItem(loader) {
  registerComponentHelper(loader, AntdBreadcrumbItem, {
    name: breadcrumbItemComponentName,
    displayName: "Breadcrumb Item",
    props: {
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "Breadcrumb Item"
        }
      },
      onClick: {
        type: "eventHandler",
        argTypes: [{ type: "object", name: "event" }]
      }
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerBreadcrumb",
    importName: "AntdBreadcrumbItem"
  });
}

export { AntdBreadcrumb, AntdBreadcrumbItem, registerBreadcrumb, registerBreadcrumbItem };
//# sourceMappingURL=registerBreadcrumb.esm.js.map
