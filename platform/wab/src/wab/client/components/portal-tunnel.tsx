import * as React from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/** The destination belongs to this tunnel and is published only by DOM commits. */
export function createPortalTunnel() {
  return createStore<HTMLElement | null>(() => null);
}

type PortalTunnel = ReturnType<typeof createPortalTunnel>;

export function PortalTunnelOut({ tunnel, className }: { tunnel: PortalTunnel; className?: string }) {
  const attach = React.useCallback((element: HTMLDivElement | null) => tunnel.setState(element, true), [tunnel]);
  return <div className={className} ref={attach} />;
}

export function PortalTunnelIn({ tunnel, children }: { tunnel: PortalTunnel; children?: React.ReactNode }) {
  const container = useStore(tunnel);
  return container ? createPortal(children, container) : null;
}
