'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-DlS9-CF8.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdBreadcrumbItem(props) {
  return props.children;
}
function AntdBreadcrumb(props) {
  const { itemsRaw, items: configuredItems, ...rest } = props;
  const items = React__default.default.useMemo(() => {
    const children = React__default.default.isValidElement(itemsRaw) && itemsRaw.type !== AntdBreadcrumbItem ? itemsRaw.props.children : itemsRaw;
    return utils.asArray(children).flat(1).filter(React__default.default.isValidElement).map((currentItem) => {
      return {
        ...currentItem.props,
        title: React__default.default.cloneElement(/* @__PURE__ */ React__default.default.createElement(React__default.default.Fragment, null, currentItem))
      };
    });
  }, [itemsRaw]);
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Breadcrumb,
    {
      ...rest,
      items: itemsRaw === void 0 ? configuredItems : items
    }
  );
}
const breadcrumbItemComponentName = "plasmic-antd6-breadcrumb-item";
const breadcrumbComponentName = "plasmic-antd6-breadcrumb";
function registerBreadcrumb(loader) {
  utils.registerComponentHelper(loader, AntdBreadcrumb, {
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
  utils.registerComponentHelper(loader, AntdBreadcrumbItem, {
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

exports.AntdBreadcrumb = AntdBreadcrumb;
exports.AntdBreadcrumbItem = AntdBreadcrumbItem;
exports.registerBreadcrumb = registerBreadcrumb;
exports.registerBreadcrumbItem = registerBreadcrumbItem;
//# sourceMappingURL=registerBreadcrumb.cjs.js.map
