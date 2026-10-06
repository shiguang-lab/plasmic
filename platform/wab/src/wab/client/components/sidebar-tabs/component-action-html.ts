import { ProjectId } from "@/wab/shared/ApiSchema";
import { Component, Site } from "@/wab/shared/model/classes";
import {
  deserializePlasmicComponentAttrs,
  getDataPlasmicProject,
} from "@/wab/shared/web-exporter/component-utils";

/** Component actions refer to sibling components in their own library. */
export function htmlForComponentAction(
  html: string,
  site: Site,
  component: Component,
) {
  const projectId = getDataPlasmicProject(site, component) as
    ProjectId | undefined;
  if (!projectId) {
    return html;
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of Array.from(
    document.querySelectorAll(
      "plasmic-component[data-plasmic-component]:not([data-plasmic-project])",
    ),
  )) {
    const name = element.getAttribute("data-plasmic-component");
    if (
      name &&
      deserializePlasmicComponentAttrs(site, {
        "data-plasmic-component": name,
        "data-plasmic-project": projectId,
      })
    ) {
      element.setAttribute("data-plasmic-project", projectId);
    }
  }
  return document.body.innerHTML;
}
