import type { StyleSection } from "@plasmicapp/host/registerComponent";
import { Modal } from "antd";
import classNames from "classnames";
import React, { ReactElement, useMemo } from "react";
import {
  CanvasOverlayProps,
  previewOpenProp,
  useCanvasOverlay,
} from "./canvas-overlay";
import { Registerable, registerComponentHelper } from "./utils";

// hide sizing section, as width can only be set via a width prop, and not css!
const styleSections: StyleSection[] = [
  "visibility",
  "typography",
  "spacing",
  "background",
  "transform",
  "transitions",
  "layout",
  "overflow",
  "border",
  "shadows",
  "effects",
];

const canvasOverlay = { triggerSlot: "trigger" };

export function AntdModal(
  props: React.ComponentProps<typeof Modal> &
    CanvasOverlayProps & {
      onOpenChange?: (open: boolean) => void;
      defaultStylesClassName?: string;
      modalScopeClassName: string;
      wrapClassName: string;
      hideFooter?: boolean;
      closeOnOutsideClick?: boolean;
      trigger?: ReactElement;
    },
) {
  const {
    props: canvasProps,
    open,
    isEditing,
  } = useCanvasOverlay(props, canvasOverlay.triggerSlot);
  const {
    onOpenChange,
    onOk,
    onCancel,
    width,
    footer,
    hideFooter,
    modalScopeClassName,
    wrapClassName,
    trigger,
    mask,
    closeOnOutsideClick,
    defaultStylesClassName,
    ...rest
  } = canvasProps;

  const memoOnCancel = React.useMemo(() => {
    if (onOpenChange || onCancel) {
      return (
        e: Parameters<
          NonNullable<React.ComponentProps<typeof Modal>["onCancel"]>
        >[0],
      ) => {
        onOpenChange?.(false);
        onCancel?.(e);
      };
    } else {
      return undefined;
    }
  }, [onOpenChange, onCancel]);

  const widthProp = useMemo(() => {
    if (typeof width === "string" && /^\d+$/.test(width)) {
      return +width;
    }
    return width;
  }, [width]);

  return (
    <>
      <Modal
        {...rest}
        mask={
          closeOnOutsideClick === undefined || mask === false
            ? mask
            : {
                ...(typeof mask === "object" ? mask : {}),
                closable: closeOnOutsideClick,
              }
        }
        onOk={isEditing ? undefined : onOk}
        width={widthProp}
        onCancel={isEditing ? undefined : memoOnCancel}
        afterOpenChange={isEditing ? undefined : props.afterOpenChange}
        afterClose={isEditing ? undefined : props.afterClose}
        open={open}
        destroyOnHidden={isEditing ? true : props.destroyOnHidden}
        forceRender={isEditing ? false : props.forceRender}
        focusable={
          isEditing
            ? { trap: false, focusTriggerAfterClose: false }
            : props.focusable
        }
        footer={hideFooter ? null : footer}
        wrapClassName={wrapClassName}
        className={classNames(
          props.className,
          defaultStylesClassName,
          modalScopeClassName,
        )}
      />
      {trigger ? (
        <div onClick={isEditing ? undefined : () => onOpenChange?.(true)}>
          {trigger}
        </div>
      ) : null}
    </>
  );
}

export function registerModal(loader?: Registerable) {
  registerComponentHelper(loader, AntdModal, {
    name: "plasmic-antd6-modal",
    canvasOverlay,
    displayName: "Modal",
    styleSections,
    description:
      "[See tutorial video](https://www.youtube.com/watch?v=TkjxNJIFun8)",
    props: {
      previewOpen: previewOpenProp,
      open: {
        type: "boolean",
      },
      mask: { type: "object" },
      destroyOnHidden: { type: "boolean" },
      width: {
        type: "string",
        defaultValueHint: "520px",
        description: "Change the width of the modal",
        helpText:
          "Default unit is px. You can also use % or other units for width.",
      },
      children: {
        type: "slot",
        defaultValue: {
          type: "vbox",
          children: ["Modal content"],
        },
      },
      title: {
        type: "slot",
        defaultValue: "Modal title",
      },
      footer: {
        type: "slot",
        hidePlaceholder: true,
        hidden: (ps: any) => ps.hideFooter ?? false,
      },
      trigger: {
        type: "slot",
        hidePlaceholder: true,
        defaultValue: {
          type: "component",
          name: "plasmic-antd6-button",
          props: {
            children: {
              type: "text",
              value: "Show modal",
            },
          },
        },
        ...({
          mergeWithParent: true,
        } as any),
      },
      closeIcon: {
        type: "slot",
        hidePlaceholder: true,
      },
      onOk: {
        type: "eventHandler",
        argTypes: [],
        description:
          "Validate and save, then explicitly close the modal after success. Clicking OK does not change open automatically.",
      } as any,
      onCancel: {
        type: "eventHandler",
        argTypes: [],
      } as any,
      okText: {
        type: "string",
        hidden: (ps: any) => !!ps.footer,
        advanced: true,
      },
      cancelText: {
        type: "string",
        hidden: (ps: any) => !!ps.footer,
        advanced: true,
      },
      hideFooter: {
        type: "boolean",
        description: "Hide the modal footer slot",
        advanced: true,
      },
      confirmLoading: {
        type: "boolean",
        description: "Show loading on the default OK button while saving.",
      },
      okButtonProps: {
        type: "object",
        advanced: true,
        description: "Native Button props for the default OK button.",
      },
      cancelButtonProps: {
        type: "object",
        advanced: true,
        description: "Native Button props for the default Cancel button.",
      },
      onOpenChange: {
        type: "eventHandler",
        argTypes: [{ name: "open", type: "boolean" }],
      } as any,
      closeOnOutsideClick: {
        type: "boolean",
        displayName: "Close modal on outside click?",
        description:
          "Whether to close the modal when user clicks outside the modal",
        defaultValueHint: true,
      },
      wrapClassName: {
        type: "class",
        displayName: "Modal overlay",
        styleSections: ["background"],
      },
      modalScopeClassName: {
        type: "styleScopeClass",
        scopeName: "modal",
      } as any,
      modalContentClassName: {
        type: "class",
        displayName: "Modal content",
        noSelf: true,
        styleSections,
        selectors: [
          {
            selector: ":modal .ant-modal-container",
            label: "Base",
          },
        ],
      } as any,
      closeButtonClassName: {
        type: "class",
        displayName: "Close button",
        noSelf: true,
        selectors: [
          {
            selector: ":modal .ant-modal-close",
            label: "Base",
          },
        ],
        advanced: true,
      } as any,
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
    templates: {
      "Modal Form": {
        props: {
          children: {
            type: "component",
            name: "plasmic-antd6-form",
          },
          hideFooter: true,
        },
      },
      "Generic Modal": {},
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerModal",
    importName: "AntdModal",
  });
}
