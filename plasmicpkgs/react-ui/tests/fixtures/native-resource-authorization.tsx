import {
  ResourceAuthorization,
  type ResourceAuthorizationProps,
} from "@react/ui";
import React, { useState } from "react";

// Representative output when a Studio trigger slot becomes native React code.
// Both siblings remain in the original row's scope. Wrapper props are consumed
// by the page's events; the native component receives only its real contract.
export function NativeAuthorizationExample({
  record,
  onOpenChange,
  onClose,
  triggerDisabled,
  onTriggerClick,
  ...resourceProps
}: Omit<ResourceAuthorizationProps, "open" | "onClose"> & {
  record: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  triggerDisabled?: boolean;
  onTriggerClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange(nextOpen);
  };
  const close = () => {
    changeOpen(false);
    onClose();
  };
  const { resourceName, ...recordProps } = resourceProps;
  return (
    <>
      <button disabled={triggerDisabled} onClick={(event) => {
        onTriggerClick?.(event);
        if (!event.defaultPrevented) changeOpen(true);
      }}>原生打开</button>
      {record ? (
        <ResourceAuthorization.Record {...recordProps} open={open} onClose={close} />
      ) : (
        <ResourceAuthorization {...recordProps} resourceName={resourceName} open={open} onClose={close} />
      )}
    </>
  );
}
