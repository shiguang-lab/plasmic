import {
  findPreviewPage,
  isPageTransitionPreset,
  readBusinessLocation,
  runPageTransition,
  type PageTransitionPreset,
  type PreviewPage,
  type PreviewDevice,
} from "@plasmic-shared/preview";
import * as React from "react";
import { flushSync } from "react-dom";

interface NavigationEntry {
  index: number;
  preset?: PageTransitionPreset;
}
function readEntry(): NavigationEntry | undefined {
  const entry = window.history.state?.plasmicNavigation;
  return entry && Number.isInteger(entry.index) &&
    (entry.preset === undefined || isPageTransitionPreset(entry.preset))
    ? entry : undefined;
}

/** Keep the visible route until the view-transition callback commits the next
 * page. History entries remember the entering effect for Back/Forward. */
export function usePublishedRoute(entryPath: string, pages: PreviewPage[], device: PreviewDevice = "desktop") {
  // PublishedPage is client-only; read the destination before its first paint.
  const [hash, setHash] = React.useState(() => window.location.hash);
  const previous = React.useRef<{ hash: string; entry?: NavigationEntry } | undefined>(undefined);

  const commit = React.useCallback(async () => {
    const next = { hash: window.location.hash, entry: readEntry() };
    const from = previous.current;
    if (from?.hash === next.hash) { return; }
    previous.current = next;
    const fromPath = readBusinessLocation(from?.hash, entryPath).pathname;
    const toPath = readBusinessLocation(next.hash, entryPath).pathname;
    const reverse = !!(from?.entry && next.entry && next.entry.index < from.entry.index);
    await runPageTransition(document, () => {
      flushSync(() => setHash(next.hash));
    }, from && fromPath !== toPath && findPreviewPage(pages, toPath)
      ? { preset: (reverse ? from.entry : next.entry)?.preset, reverse, device }
      : undefined);
  }, [entryPath, pages, device]);

  React.useEffect(() => {
    if (!readEntry()) {
      window.history.replaceState({ ...window.history.state, plasmicNavigation: { index: 0 } }, "");
    }
    previous.current = { hash: window.location.hash, entry: readEntry() };
    setHash(window.location.hash);
    const onRoute = () => { void commit(); };
    window.addEventListener("popstate", onRoute);
    window.addEventListener("hashchange", onRoute);
    return () => {
      window.removeEventListener("popstate", onRoute);
      window.removeEventListener("hashchange", onRoute);
    };
  }, [commit]);

  const navigate = React.useCallback(async (href: string, replace: boolean, preset?: PageTransitionPreset) => {
    if (href === window.location.pathname + window.location.hash) { return; }
    const entry: NavigationEntry = {
      index: (readEntry()?.index ?? 0) + (replace ? 0 : 1),
      preset,
    };
    window.history[replace ? "replaceState" : "pushState"]({ ...window.history.state, plasmicNavigation: entry }, "", href);
    await commit();
  }, [commit]);

  const goBack = React.useCallback(() => {
    if ((readEntry()?.index ?? 0) > 0) { window.history.back(); }
  }, []);
  return { hash, navigate, goBack };
}
