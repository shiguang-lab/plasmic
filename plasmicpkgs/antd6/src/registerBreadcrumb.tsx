import type { BreadcrumbItemProps, BreadcrumbProps } from "antd";
import { Breadcrumb } from "antd";
import React from "react";
import { Registerable, asArray, registerComponentHelper } from "./utils";

export function AntdBreadcrumbItem(props: BreadcrumbItemProps) {
  return props.children;
}

export function AntdBreadcrumb(
  props: BreadcrumbProps & { itemsRaw?: React.ReactNode },
) {
  const { itemsRaw, items: configuredItems, ...rest } = props;
  const items = React.useMemo(() => {
    const children =
      React.isValidElement(itemsRaw) && itemsRaw.type !== AntdBreadcrumbItem
        ? itemsRaw.props.children
        : itemsRaw;
    return asArray(children)
      .flat(1)
      .filter(React.isValidElement)
      .map((currentItem: React.ReactElement) => {
        return {
          ...currentItem.props,
          title: React.cloneElement(<>{currentItem}</>),
        };
      });
  }, [itemsRaw]);

  return (
    <Breadcrumb
      {...rest}
      items={itemsRaw === undefined ? configuredItems : items}
    />
  );
}

const breadcrumbItemComponentName = "plasmic-antd6-breadcrumb-item";
const breadcrumbComponentName = "plasmic-antd6-breadcrumb";

export function registerBreadcrumb(loader?: Registerable) {
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
                value: "First",
              },
            },
          },
          {
            type: "component",
            name: breadcrumbItemComponentName,
            props: {
              children: {
                type: "text",
                value: "Second",
              },
            },
          },
          {
            type: "component",
            name: breadcrumbItemComponentName,
            props: {
              children: {
                type: "text",
                value: "Third",
              },
            },
          },
        ],
        allowedComponents: [breadcrumbItemComponentName],
      },
      separator: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "/",
        },
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerBreadcrumb",
    importName: "AntdBreadcrumb",
  });
}

export function registerBreadcrumbItem(loader?: Registerable) {
  registerComponentHelper(loader, AntdBreadcrumbItem, {
    name: breadcrumbItemComponentName,
    displayName: "Breadcrumb Item",
    props: {
      children: {
        type: "slot",
        defaultValue: {
          type: "text",
          value: "Breadcrumb Item",
        },
      },
      onClick: {
        type: "eventHandler",
        argTypes: [{ type: "object", name: "event" }],
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerBreadcrumb",
    importName: "AntdBreadcrumbItem",
  });
}
