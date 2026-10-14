import registerComponent, {
  CodeComponentMeta,
} from "@plasmicapp/host/registerComponent";
import {
  ResourceAuthorization as ReactUIResourceAuthorization,
  ResourceAuthorizationProps as ReactUIResourceAuthorizationProps,
  ResourceAuthorizationRecordProps as ReactUIResourceAuthorizationRecordProps,
} from "@react/ui";
import { ResourceAuthorizationCanvasContext } from "@react/ui/esm/resource-authorization/canvas-context.js";
import {
  CanvasOverlayProps,
  previewOpenProp,
  useCanvasOverlay,
} from "@shiguang-lab/plasmic-antd6/skinny/canvas-overlay";
import React from "react";
import type { Registerable } from "./registerActionGroup";

type OverlayProps = CanvasOverlayProps & {
  open?: boolean;
  trigger?: React.ReactNode;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
};

export type ResourceAuthorizationProps = Omit<
  ReactUIResourceAuthorizationProps, "open" | "onClose"
> & OverlayProps;
export type ResourceAuthorizationRecordProps =
  Omit<ReactUIResourceAuthorizationRecordProps, "open" | "onClose"> & OverlayProps;

const canvasOverlay = { triggerSlot: "trigger" };

function useAuthorizationOverlay<P extends OverlayProps & { onSuccess?: () => void }>(props: P) {
  const [localOpen, setLocalOpen] = React.useState(false);
  const { props: rest, open, isEditing } = useCanvasOverlay(
    { ...props, open: props.open ?? localOpen },
    canvasOverlay.triggerSlot,
  );
  const { trigger, onClose, onSuccess, onOpenChange, ...businessProps } = rest;
  const changeOpen = (nextOpen: boolean) => {
    if (isEditing) return;
    if (props.open === undefined) setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  return {
    businessProps,
    open: !!open,
    isEditing,
    onSuccess: isEditing ? undefined : onSuccess,
    onClose: () => {
      if (isEditing) return;
      changeOpen(false);
      onClose?.();
    },
    trigger: trigger == null ? null : (
      <span
        style={{ display: "inline-flex" }}
        onClick={isEditing ? undefined : (event) => {
          if (event.defaultPrevented ||
              (event.target instanceof Element && event.target.closest('button:disabled, [aria-disabled="true"]'))) return;
          changeOpen(true);
        }}
      >
        {trigger}
      </span>
    ),
  };
}

export function ResourceAuthorization(props: ResourceAuthorizationProps) {
  const { businessProps, open, isEditing, trigger, onClose, onSuccess } = useAuthorizationOverlay(props);
  return (
    <ResourceAuthorizationCanvasContext.Provider value={isEditing}>
      {trigger}
      <ReactUIResourceAuthorization
        {...businessProps}
        open={open}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </ResourceAuthorizationCanvasContext.Provider>
  );
}

export function ResourceAuthorizationRecord(
  props: ResourceAuthorizationRecordProps,
) {
  const { businessProps, open, isEditing, trigger, onClose, onSuccess } = useAuthorizationOverlay(props);
  return (
    <ResourceAuthorizationCanvasContext.Provider value={isEditing}>
      {trigger}
      <ReactUIResourceAuthorization.Record
        {...businessProps}
        open={open}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </ResourceAuthorizationCanvasContext.Provider>
  );
}

const commonProps = {
  previewOpen: previewOpenProp,
  open: { type: "boolean", defaultValueHint: false },
  trigger: {
    type: "slot",
    hidePlaceholder: true,
    description: "Click the trigger to open the drawer. Omit Open for internal state, or bind Open and On open change for controlled state. This slot belongs to the Studio wrapper, not the native @react/ui component.",
  },
  resourceTypeCode: { type: "string", description: "Resource type code." },
  resourceId: { type: "string", description: "Resource ID." },
  title: { type: "slot", hidePlaceholder: true },
  width: { type: "number", defaultValueHint: 600 },
  apiSources: {
    type: "object",
    fields: {
      dataPolicy: { type: "string" },
      dataResourceTypeList: { type: "string" },
      userOptions: { type: "string" },
      deptTree: { type: "string" },
    },
    description: "Override API URLs. Requests use the host's window.$$request.",
  },
  onClose: { type: "eventHandler", argTypes: [] },
  onSuccess: { type: "eventHandler", argTypes: [] },
  onOpenChange: {
    type: "eventHandler",
    argTypes: [{ name: "open", type: "boolean" }],
  },
} satisfies CodeComponentMeta<ResourceAuthorizationRecordProps>["props"];

const openState = {
  open: {
    type: "writable" as const,
    valueProp: "open",
    onChangeProp: "onOpenChange",
    variableType: "boolean" as const,
  },
};

export const resourceAuthorizationMeta: CodeComponentMeta<ResourceAuthorizationProps> = {
  name: "plasmic-react-ui-resource-authorization",
  displayName: "ResourceAuthorization",
  section: "React UI",
  description: "Create personalized resource authorization for a user or department.",
  importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerResourceAuthorization",
  importName: "ResourceAuthorization",
  canvasOverlay,
  props: {
    ...commonProps,
    resourceName: { type: "string", description: "Resource name." },
    width: { type: "number", defaultValueHint: 500 },
  },
  states: openState,
};

export const resourceAuthorizationRecordMeta: CodeComponentMeta<ResourceAuthorizationRecordProps> = {
  name: "plasmic-react-ui-resource-authorization-record",
  displayName: "ResourceAuthorization.Record",
  section: "React UI",
  description: "View resource permissions and delete personalized authorization policies.",
  importPath: "@shiguang-lab/plasmic-react-ui/skinny/registerResourceAuthorization",
  importName: "ResourceAuthorizationRecord",
  canvasOverlay,
  props: commonProps,
  states: openState,
};

export function registerResourceAuthorization(loader?: Registerable) {
  const register = loader?.registerComponent ?? registerComponent;
  register(ResourceAuthorization, resourceAuthorizationMeta);
  register(ResourceAuthorizationRecord, resourceAuthorizationRecordMeta);
}
