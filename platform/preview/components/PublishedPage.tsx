import {
  businessPath,
  findPreviewPage,
  formatBusinessHref,
  publicationHref,
  publicationPath,
  readBusinessAnchor,
  readBusinessLocation,
  readBusinessQuery,
  type BusinessHref,
  type PreviewPage,
} from "@plasmic-shared/preview";
import type { ComponentRenderData } from "@plasmicapp/loader-nextjs";
import {
  PlasmicComponent,
  PlasmicRootProvider,
  initPlasmicLoader,
} from "@plasmicapp/loader-nextjs";
import * as NextRouter from "next/router";
import React from "react";
import * as ReactDOMClient from "react-dom/client";

export interface PublishedPageProps {
  code: string;
  projectId: string;
  version: string;
  entryPath: string;
  pages: PreviewPage[];
  bundle: ComponentRenderData["bundle"];
}
const RouteContext = React.createContext<
  | {
      path: string;
      route: string;
      params: Record<string, string | string[]>;
      query: Record<string, string | string[]>;
      navigate: (href: BusinessHref, replace?: boolean) => Promise<boolean>;
    }
  | undefined
>(undefined);
function subscribeRoute(update: () => void) {
  window.addEventListener("hashchange", update);
  window.addEventListener("popstate", update);
  return () => {
    window.removeEventListener("hashchange", update);
    window.removeEventListener("popstate", update);
  };
}

export default function PublishedPage({
  code,
  projectId,
  version,
  bundle,
  pages,
  entryPath,
}: PublishedPageProps) {
  const anchorHrefs = React.useRef(
    new WeakMap<HTMLAnchorElement, { source: string; encoded: string }>(),
  );
  const hash = React.useSyncExternalStore(
    subscribeRoute,
    () => window.location.hash,
    () => "",
  );
  const location = readBusinessLocation(hash, entryPath);
  const path = businessPath(location);
  const match = findPreviewPage(pages, location.pathname);
  const query = readBusinessQuery(location.search);
  React.useEffect(() => {
    if (!window.location.hash.startsWith("#/")) {
      window.history.replaceState(null, "", publicationPath(code, entryPath));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }, [code, entryPath]);
  React.useEffect(() => {
    if (location.hash) {
      requestAnimationFrame(() =>
        document
          .getElementById(readBusinessAnchor(location.hash))
          ?.scrollIntoView(),
      );
    }
  }, [path]);
  const navigate = React.useCallback(
    async (value: BusinessHref, replace = false) => {
      const href = publicationHref(
        code,
        value,
        window.location.href,
        entryPath,
      );
      if (!href.startsWith(`/s/${code}#/`)) {
        window.location.assign(href);
        return true;
      }
      if (href === window.location.pathname + window.location.hash) {
        return true;
      }
      window.history[replace ? "replaceState" : "pushState"](null, "", href);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return true;
    },
    [code, entryPath],
  );
  const runtime = React.useMemo(() => {
    const loader = initPlasmicLoader({
      projects: [{ id: projectId, version, token: "" }],
      preview: false,
    });
    function usePublishedRouter() {
      const router = NextRouter.useRouter();
      const current = React.useContext(RouteContext);
      if (!current) {
        throw new Error("Missing published route");
      }
      return {
        ...router,
        pathname: current.route,
        route: current.route,
        asPath: current.path,
        query: { ...current.params, ...current.query },
        push: (href: BusinessHref) => current.navigate(href),
        replace: (href: BusinessHref) => current.navigate(href, true),
        back: () => window.history.back(),
        forward: () => window.history.forward(),
        reload: () => window.location.reload(),
        prefetch: async () => undefined,
      };
    }
    const PublishedLink = React.forwardRef<
      HTMLAnchorElement,
      Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
        href: BusinessHref;
        replace?: boolean;
      }
    >(function PublishedLink({ href, replace, onClick, ...rest }, ref) {
      const current = React.useContext(RouteContext);
      const renderedHref =
        rest.download == null
          ? publicationHref(code, href, window.location.href, entryPath)
          : formatBusinessHref(href);
      return (
        <a
          {...rest}
          ref={ref}
          href={renderedHref}
          onClick={(event) => {
            onClick?.(event);
            if (
              !event.defaultPrevented &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0 &&
              (!rest.target || rest.target === "_self") &&
              rest.download == null &&
              renderedHref.startsWith(`/s/${code}#/`)
            ) {
              event.preventDefault();
              void current?.navigate(href, replace);
            }
          }}
        />
      );
    });
    loader.registerModules({
      "react-dom/client": ReactDOMClient,
      "next/router": { ...NextRouter, useRouter: usePublishedRouter },
      "next/link": PublishedLink,
    });
    return { loader, PublishedLink };
  }, [code, projectId, version, entryPath]);
  if (!match) {
    return <main role="alert">Page not found: {location.pathname}</main>;
  }
  const entry = bundle.components.find(
    (component) => component.id === match.page.id,
  );
  if (!entry) {
    return <main role="alert">Page not found: {location.pathname}</main>;
  }
  const data: ComponentRenderData = {
    bundle: {
      ...bundle,
      filteredIds: Object.fromEntries(
        bundle.projects.map((project) => [project.id, []]),
      ),
      deferChunksByDefault: false,
    },
    entryCompMetas: [
      {
        ...entry,
        params: Object.fromEntries(
          Object.entries(match.params).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join("/") : value,
          ]),
        ),
      },
    ],
    remoteFontUrls: bundle.projects.flatMap((project) =>
      project.remoteFonts.map((font) => font.url),
    ),
  };
  return (
    <RouteContext.Provider
      value={{
        path,
        route: match.page.path,
        params: match.params,
        query,
        navigate,
      }}
    >
      <div
        onClick={handleAnchorClick}
        onAuxClick={handleAnchorClick}
        onContextMenu={handleAnchorClick}
      >
        <PlasmicRootProvider
          loader={runtime.loader}
          prefetchedData={data}
          Link={runtime.PublishedLink}
          pageRoute={match.page.path}
          pageParams={match.params}
          pageQuery={query}
        >
          <PlasmicComponent
            component={entry.name}
            projectId={projectId}
            key={`${projectId}:${location.pathname}`}
          />
        </PlasmicRootProvider>
      </div>
    </RouteContext.Provider>
  );

  function handleAnchorClick(event: React.MouseEvent<HTMLDivElement>) {
    const anchor =
      event.target instanceof Element ? event.target.closest("a") : null;
    if (!anchor || event.defaultPrevented || anchor.hasAttribute("download")) {
      return;
    }
    const raw = anchor.getAttribute("href");
    const previous = anchorHrefs.current.get(anchor);
    const href = raw === previous?.encoded ? previous.source : raw;
    if (!href) {
      return;
    }
    if (href === "#") {
      event.preventDefault();
      return;
    }
    const destination = publicationHref(
      code,
      href,
      window.location.href,
      entryPath,
    );
    if (destination.startsWith(`/s/${code}#/`)) {
      if (
        event.type === "contextmenu" ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (anchor.target && anchor.target !== "_self")
      ) {
        anchor.setAttribute("href", destination);
        anchorHrefs.current.set(anchor, { source: href, encoded: destination });
        if (event.type === "contextmenu") {
          return;
        }
        // Preserve relative hrefs for later clicks after SPA navigation.
        setTimeout(() => {
          if (anchor.getAttribute("href") === destination) {
            anchor.setAttribute("href", href);
            anchorHrefs.current.delete(anchor);
          }
        }, 0);
        return;
      }
      event.preventDefault();
      void navigate(destination);
    }
  }
}
