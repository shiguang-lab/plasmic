import * as React from "react";

export interface CanvasSnapshotStore<T> {
  subscribe(listener: () => void): () => void;
  getState(): T;
  getInitialState(): T;
}

export interface CanvasFrameInfo {
  readonly viewMode: "stretch" | "centered";
  readonly height: number;
  readonly isHeightAutoDerived: boolean;
  readonly fullPageHeight: boolean;
  readonly bgColor: string | undefined;
}

interface CanvasFrameUser {
  readonly email?: string;
  readonly roleId?: string;
  readonly roleName?: string;
  readonly roleIds?: readonly string[];
  readonly roleNames?: readonly string[];
  readonly isLoggedIn?: boolean;
}

export interface CanvasFrameProps {
  readonly children?: React.ReactNode;
  readonly frameInfo: CanvasSnapshotStore<CanvasFrameInfo>;
  readonly currentUser: CanvasSnapshotStore<{
    readonly appUser: CanvasFrameUser;
    readonly fakeAuthToken?: string;
  }>;
  readonly lifetime: AbortSignal;
  readonly DataSourceProvider: React.ElementType;
}

/** The frame owns its Hooks, DOM and context provider in its own React realm. */
export function CanvasFrame({ children, frameInfo, currentUser, lifetime, DataSourceProvider }: CanvasFrameProps) {
  const { viewMode, height, isHeightAutoDerived, fullPageHeight, bgColor } =
    React.useSyncExternalStore(frameInfo.subscribe, frameInfo.getState, frameInfo.getInitialState);
  const appUserCtx = React.useSyncExternalStore(currentUser.subscribe, currentUser.getState, currentUser.getInitialState);
  const subscribeLifetime = React.useCallback((listener: () => void) => {
    lifetime.addEventListener("abort", listener, { once: true });
    return () => lifetime.removeEventListener("abort", listener);
  }, [lifetime]);
  const isActive = React.useCallback(() => !lifetime.aborted, [lifetime]);
  const active = React.useSyncExternalStore(subscribeLifetime, isActive, isActive);
  React.useEffect(() => {
    if (!lifetime.aborted) {
      document.body.style.backgroundColor = bgColor || "unset";
    }
  }, [bgColor, lifetime]);
  if (!active) {
    return null;
  }
  const showFullHeight = isHeightAutoDerived && fullPageHeight;
  const className = [
    "__wab_root",
    viewMode === "stretch" ? "__wab_root--stretch" : "__wab_root--centered",
    viewMode === "centered" && !bgColor ? "__wab_root--checkerboard" : "",
    isHeightAutoDerived ? "__wab_root--page-stretch" : "",
    showFullHeight ? "__wab_root--full-height" : "",
  ].filter(Boolean).join(" ");
  const { appUser } = appUserCtx;
  return <DataSourceProvider value={{
    user: {
      email: appUser.email,
      roleId: appUser.roleId,
      roleName: appUser.roleName,
      roleIds: appUser.roleIds?.map((roleId) => roleId),
      roleNames: appUser.roleNames?.map((roleName) => roleName),
      isLoggedIn: appUser.isLoggedIn,
    },
    userAuthToken: appUserCtx.fakeAuthToken,
  }}><div className={className} style={{
    minHeight: `${height}px`,
    "--viewport-height": `${height}px`,
    ...(showFullHeight ? { "--canvas-content-height": "auto" } : {}),
  } as React.CSSProperties}>{children}</div></DataSourceProvider>;
}
