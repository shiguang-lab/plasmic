import { reportError } from "@/wab/client/ErrorNotifications";
import type { History } from "history";
import { mutate } from "swr";

type DesktopViewState = { active: boolean; url?: string };
function desktopBridge() {
  return (window as Window & {
    desktopNavigation?: {
      navigate(url: string): Promise<void>;
      isActive(): boolean;
      onActiveChange(callback: (state: DesktopViewState) => void): () => void;
    };
  }).desktopNavigation;
}
export function isDesktopViewActive(): boolean {
  return desktopBridge()?.isActive() ?? true;
}
export function subscribeDesktopView(callback: (state: DesktopViewState) => void): () => void {
  return desktopBridge()?.onActiveChange(callback) ?? (() => undefined);
}

export function installDesktopNavigation(history: History): () => void {
  const bridge = desktopBridge();
  if (!bridge) {
    return () => undefined;
  }
  const projectId = (pathname: string) => pathname.match(/^\/projects\/([^/]+)(?:\/|$)/)?.[1];
  const push = history.push;
  const replace = history.replace;
  const navigate = (to: Parameters<History["push"]>[0]) => {
    const url = new URL(history.createHref(to), window.location.href);
    if (projectId(history.location.pathname) === projectId(url.pathname)) {
      return false;
    }
    // Keep the editor mounted until Desktop has protected the draft. Using
    // history.block() here would also add an unconditional beforeunload prompt.
    void bridge.navigate(url.href).catch(reportError);
    return true;
  };
  const stopActivation = bridge.onActiveChange(({ active, url }) => {
    if (!active || !url) {
      return;
    }
    const destination = new URL(url);
    if (destination.href !== new URL(history.createHref(history.location), window.location.href).href) {
      replace(destination.pathname + destination.search + destination.hash);
    }
    // Keep mounted data visible while refreshing project metadata in the background.
    void mutate(key => key === "/projects" || Array.isArray(key) &&
      ["workspace", "desktop-drafts"].includes(key[0])).catch(reportError);
  });
  history.push = (to, state) => {
    if (!navigate(to)) {
      push(to, state);
    }
  };
  history.replace = (to, state) => {
    if (!navigate(to)) {
      replace(to, state);
    }
  };
  return () => {
    stopActivation();
    history.push = push;
    history.replace = replace;
  };
}
