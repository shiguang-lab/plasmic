import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import { ensureCanvasRuntime } from "@/wab/client/components/studio/studio-bundles";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { lt } from "@/wab/commons/semver";
import { assert } from "@/wab/shared/common";
import { requiredPackageVersions } from "@/wab/shared/required-versions";
import { notification } from "antd";
import React from "react";

export interface PlasmicWindowInternals {
  EXECUTE_SERVER_QUERY?: (
    id: string,
    fn: (...args) => Promise<any>,
    ...args: any[]
  ) => Promise<any>;
}

/**
 * window.parent is the root window of the host app (either user's host app or our own),
 * where @plasmicapp/host is loaded.
 * We use this to get the SubDeps from the host app.
 */
let rootSub: SubDeps | undefined = undefined;
try {
  rootSub = (window.parent as any).__Sub;
} catch {}

export function getRootSub(): SubDeps {
  assert(rootSub, "Should only get rootSub from host iframe");
  return rootSub;
}

export function getRootSubHostVersion() {
  return getRootSub().hostVersion;
}

export function getRootSubReactVersion(): string {
  return getRootSub().React.version;
}

export function getRootSubReact(): typeof React {
  return getRootSub().React;
}

export function checkRootSubHostVersion() {
  const hostVersion = getRootSubHostVersion();
  if (
    !hostVersion ||
    lt(hostVersion, requiredPackageVersions["@plasmicapp/host"])
  ) {
    // TODO: Detect if the user is using loader-nextjs, loader-gatsby,
    // loader-react or codegen to display a more directed message.
    notification.warning({
      message: translate(getUiLocale(), "Unsupported host app detected"),
      description: (
        <>
          {" "}
          <UiText message={"Please upgrade"} /> <code>@plasmicapp/*</code>{" "}
          <UiText
            message={
              "packages in your host app to continue using Plasmic Studio's latest features."
            }
          />{" "}
        </>
      ),
      duration: 0,
    });
  }
}

export async function initRootCanvasPkgs() {
  await ensureCanvasRuntime(window.parent);
  rootSub = {
    ...rootSub,
    ...(window.parent as any).__CanvasPkgs,
  };
}
