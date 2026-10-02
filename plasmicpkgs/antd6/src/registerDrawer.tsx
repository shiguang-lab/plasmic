import { Drawer } from "antd";
import React from "react";
import { Registerable, registerComponentHelper } from "./utils";

export function AntdDrawer(
  props: React.ComponentProps<typeof Drawer> & {
    onOpenChange?: (open: boolean) => void;
    defaultStylesClassName?: string;
    drawerScopeClassName?: string;
  },
) {
  const { onOpenChange, onClose, open, footer, drawerScopeClassName, ...rest } =
    props;
  const memoOnClose = React.useMemo(() => {
    if (onOpenChange || onClose) {
      return (
        e: Parameters<
          NonNullable<React.ComponentProps<typeof Drawer>["onClose"]>
        >[0],
      ) => {
        onOpenChange?.(false);
        onClose?.(e);
      };
    } else {
      return undefined;
    }
  }, [onOpenChange, onClose]);
  return (
    <Drawer
      {...rest}
      onClose={memoOnClose}
      rootClassName={drawerScopeClassName}
      open={open}
      footer={footer ?? undefined}
      className={`${props.className} ${props.defaultStylesClassName}`}
    />
  );
}

export function registerDrawer(loader?: Registerable) {
  registerComponentHelper(loader, AntdDrawer, {
    name: "plasmic-antd6-drawer",
    displayName: "Drawer",
    props: {
      open: {
        type: "boolean",
      },
      size: { type: "number", defaultValueHint: 378 },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      placement: {
        type: "choice",
        options: ["top", "right", "bottom", "left"],
        defaultValueHint: "right",
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Drawer content"],
        },
      },
      title: {
        type: "slot",
        defaultValue: "Drawer title",
      },
      footer: {
        type: "slot",
        hidePlaceholder: true,
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
      } as any,
      drawerScopeClassName: {
        type: "styleScopeClass",
        scopeName: "drawer",
      } as any,
      drawerHeaderClassName: {
        type: "class",
        displayName: "Drawer header",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-header",
            label: "Base",
          },
        ],
      } as any,
      drawerBodyClassName: {
        type: "class",
        displayName: "Drawer body",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-body",
            label: "Base",
          },
        ],
      } as any,
      drawerFooterClassName: {
        type: "class",
        displayName: "Drawer footer",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-footer",
            label: "Base",
          },
        ],
      } as any,
      drawerTitleClassName: {
        type: "class",
        displayName: "Drawer title",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-title",
            label: "Base",
          },
        ],
      } as any,
      drawerMaskClassName: {
        type: "class",
        displayName: "Drawer mask",
        styleSections: ["background"],
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-mask",
            label: "Base",
          },
        ],
      } as any,
      drawerContentWrapperClassName: {
        type: "class",
        displayName: "Drawer content wrapper",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-content-wrapper",
            label: "Base",
          },
        ],
        advanced: true,
      } as any,
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":drawer .ant-drawer-close",
            label: "Base",
          },
        ],
        advanced: true,
      } as any,
      forceRender: {
        advanced: true,
        type: "boolean",
      },
      defaultStylesClassName: {
        type: "themeResetClass",
      } as any,
    },
    states: {
      open: {
        type: "writable",
        valueProp: "open",
        onChangeProp: "onOpenChange",
        variableType: "boolean",
      },
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerDrawer",
    importName: "AntdDrawer",
  });
}
