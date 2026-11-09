import {
  showCanvasPageNavigationNotification,
  trapInteractionError,
} from "@/wab/client/components/canvas/studio-canvas-util";
import type { CodePreviewCtx } from "@/wab/client/components/docs/CodePreviewCtx";
import { useDocsFocusedComponentRef, useDocsFocusedIconRef } from "@/wab/client/components/docs/DocsModelResources";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { syncDocsPreview } from "@/wab/client/components/docs/serialize-docs-preview";
import { onLoadInjectLiveRuntime } from "@/wab/client/components/live/live-syncer";
import {
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { UiText } from "@/wab/client/i18n/UiText";
import { scriptExec } from "@/wab/client/script-exec";
import { maybeToggleTrailingSlash } from "@/wab/client/utils/app-hosting-utils";
import { nodeJsName } from "@/wab/shared/codegen/react-p";
import { getExportedComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { toJsIdentifier } from "@/wab/shared/codegen/util";
import { ensure, spawn } from "@/wab/shared/common";
import {
  InteractionArgLoc,
  InteractionLoc,
  isInteractionLoc,
} from "@/wab/shared/core/exprs";
import { TplNamable } from "@/wab/shared/core/tpls";
import { Component } from "@/wab/shared/model/classes";
import { getPublicUrl, getStaticBaseUrl } from "@/wab/shared/urls";
import React from "react";
import { useStore } from "zustand";

async function loadDocsPreviewRuntime(
  studioCtx: DocsPortalCtx["studioCtx"],
  iframe: HTMLIFrameElement,
  packages: Parameters<typeof getSortedHostLessPkgs>[2],
) {
            const frameWindow = ensure(
              iframe.contentWindow,
              `currentTarget must be attached to window`,
            );
            const onAnchorClick = (href) =>
              showCanvasPageNavigationNotification(studioCtx, href);
            await onLoadInjectLiveRuntime(
              studioCtx,
              frameWindow,
              false,
              onAnchorClick,
            );
            (frameWindow as any).__PlasmicWrapUserFunction = (
              loc: InteractionLoc | InteractionArgLoc,
              fn: () => any,
              args: Record<string, any>,
            ) => {
              try {
                if (isInteractionLoc(loc) && loc.actionName === "navigation") {
                  onAnchorClick(`${args.destination}`);
                  return;
                }
                return fn();
              } catch (e) {
                trapInteractionError(studioCtx, loc, e);
                throw e;
              }
            };
            (frameWindow as any).__PlasmicWrapUserPromise = async (
              loc: InteractionLoc | InteractionArgLoc,
              promise: Promise<any>,
            ) => {
              try {
                return await promise;
              } catch (e) {
                trapInteractionError(studioCtx, loc, e);
                throw e;
              }
            };

            const modules = await getSortedHostLessPkgs(
              frameWindow,
              studioCtx.appCtx.api,
              packages,
              getVersionForCanvasPackages(frameWindow),
              studioCtx.site,
            );
            for (const [_pkg, pkgModule] of modules) { scriptExec(frameWindow, pkgModule); }
  return { frameWindow, identities: modules.map(([identity]) => identity) };
}

export function DocsPreviewCanvas(props: {
  docsCtx: DocsPortalCtx;
  codePreviewCtx?: CodePreviewCtx;
}) {
  const { docsCtx, codePreviewCtx } = props;
  const studioCtx = docsCtx.studioCtx;
  const hostUrl = useStore(studioCtx.uiEnvironment.store, (state) => state.hostUrl);
  const componentRef = useDocsFocusedComponentRef(docsCtx);
  const iconRef = useDocsFocusedIconRef(docsCtx);
  const [doc, setDoc] = React.useState<Document>();
  const [frameLoaded, setFrameLoaded] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const packages = useStore(docsCtx.models.getPackagesStore());
  const [installedPackages, setInstalledPackages] = React.useState<readonly string[]>([]);
  const packagesReady = packages.identities.every((identity) => installedPackages.includes(identity));
  const [toggleTrailingSlash, setToggleTrailingSlash] = React.useState(false);

  React.useEffect(() => {
    const component = componentRef && docsCtx.models.snapshots.resolve(componentRef);
    const icon = iconRef && docsCtx.models.snapshots.resolve(iconRef);
    if ((!component && !icon) || !frameLoaded || !packagesReady || !doc) {
      return;
    }

    const reposition = () => {
      // Repositions the hover box according to current view state
      if (component) {
        const focusedNode = docsCtx.getFocusedNode();
        repositionHoverBox(doc, component, focusedNode);
      }
    };

    const disposeSync = syncDocsPreview(docsCtx, doc, {
      onError: (err) => {
        setError(err);
        reposition();
      },
      onRendered: () => {
        setError(null);
        reposition();
      },
      codePreviewCtx,
    });

    reposition();
    const disposeHover = docsCtx.store.subscribe((next, previous) => {
      if (next.focusedElement !== previous.focusedElement) {
        reposition();
      }
    });

    return () => {
      disposeSync();
      disposeHover();
    };
  }, [docsCtx, codePreviewCtx, componentRef, iconRef, frameLoaded, packagesReady, doc]);

  React.useEffect(() => {
    if (!frameLoaded || !doc?.defaultView || packagesReady) { return; }
    const win = doc.defaultView;
    let active = true;
    spawn((async () => {
      const modules = await getSortedHostLessPkgs(win, studioCtx.appCtx.api, packages.packages.slice(), getVersionForCanvasPackages(win), studioCtx.site);
      for (const [identity, source] of modules) {
        if (!active) { return; }
        if (!installedPackages.includes(identity)) { scriptExec(win, source); }
      }
      if (active) { setInstalledPackages(modules.map(([identity]) => identity)); }
    })().catch((failure) => { if (active) { setError(failure); } }));
    return () => { active = false; };
  }, [doc, studioCtx, frameLoaded, packagesReady, packages, installedPackages]);

  if (!componentRef && !iconRef) {
    return null;
  }

  return (
    <>
      <iframe
        src={
          maybeToggleTrailingSlash(
            toggleTrailingSlash,
            hostUrl,
          ) +
          "#live=true" +
          `&origin=${encodeURIComponent(getPublicUrl())}` +
          `&staticBaseUrl=${encodeURIComponent(getStaticBaseUrl())}`
        }
        onLoad={(event) => loadDocsPreviewRuntime(studioCtx, event.currentTarget, packages.packages.slice())
          .then(({ frameWindow, identities }) => {
            setInstalledPackages(identities);
            setFrameLoaded(true);
            setDoc(frameWindow.document);
          })
          .catch((err: unknown) => {
            if (!toggleTrailingSlash && err != null && typeof err === "object" && "name" in err && err.name === "SecurityError") {
              console.log("SecurityError while accessing Docs Preview. Trying again...");
              setToggleTrailingSlash(true);
              return;
            }
            throw err;
          })}

        style={{
          width: "100%",
          height: "100%",
          display: error ? "none" : "block",
        }}
      />
      {error && (
        <div className="fill-width fill-height code error-bg p-xlg">
          <UiText message={"Error:"} /> {error.message}
        </div>
      )}
    </>
  );
}

/**
 * Positions a hover box within `doc` to highlight the rendered
 * element corresponding to `node`.
 */
function repositionHoverBox(
  doc: Document,
  component: Component,
  node: TplNamable | undefined,
) {
  /**
   * Get existing highlighter box, or create one if one doesn't exit yet
   */
  const getHoverElt = () => {
    const existing = doc.querySelector(".__plasmic__hover");
    if (existing) {
      return existing as HTMLElement;
    }

    const elt = doc.createElement("div");
    elt.className = "__plasmic__hover";
    elt.style.position = "absolute";
    elt.style.zIndex = "10000";
    elt.style.boxShadow = "0 0 0 2px #04A4F4";
    doc.body.appendChild(elt);
    return elt;
  };

  const hoverElt = getHoverElt();

  if (!node) {
    // Nothing to highlight
    hoverElt.style.display = "none";
    return;
  }

  // For now, we fetch the element corresponding to `node` with this
  // hacky trick -- by re-creating the class name that it would have
  // for the base variant, and querying by it.  We should think about
  // more robust ways of doing this (like, marking elements with an
  // explicit data-plasmic-id attribute in the generated code, etc)
  // The nice-ish thing here is that we don't have to muck with code
  // generation to achieve this.
  const focusedNodeClassName = `${getExportedComponentName(
    component,
  )}__${nodeJsName(component, node)}__${toJsIdentifier(
    node.uuid.substring(0, 5),
  )}`;
  const canvasElt = doc.querySelector(`.${focusedNodeClassName}`);

  if (!canvasElt) {
    // Doesn't exist; element not rendered
    hoverElt.style.display = "none";
    return;
  }

  const canvasEltBox = canvasElt.getBoundingClientRect();

  // Position hoverElt at exactly the same location
  hoverElt.style.display = "block";
  hoverElt.style.left = `${canvasEltBox.left}px`;
  hoverElt.style.top = `${canvasEltBox.top}px`;
  hoverElt.style.width = `${canvasEltBox.width}px`;
  hoverElt.style.height = `${canvasEltBox.height}px`;
}
