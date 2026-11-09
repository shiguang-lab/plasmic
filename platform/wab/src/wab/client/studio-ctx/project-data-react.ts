import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isEqual } from "lodash";
import * as React from "react";

/**
 * Component/page list for the data picker and copilot.
 *
 * Only catalog membership, builtin filtering, names and page routes affect it.
 * Editing a component's contents never recomputes this directory.
 */
export function useProjectData(
  studio: StudioCtx,
): ReturnType<StudioCtx["getProjectData"]> {
  const models = studio.modelSnapshots;
  const source = React.useMemo(() => new ModelFieldSelector(studio, (read) => {
    for (const ref of read(studio.site, "components")) {
      const component = models.resolve(ref);
      read(component, "name");
      const meta = read(component, "codeComponentMeta");
      if (meta) { read(models.resolve(meta), "importPath"); }
      const pageMeta = read(component, "pageMeta");
      if (pageMeta) { read(models.resolve(pageMeta), "path"); }
    }
    const data = studio.getProjectData();
    data.components.forEach(Object.freeze);
    data.pages.forEach((page) => { Object.freeze(page.pageMeta); Object.freeze(page); });
    Object.freeze(data.components); Object.freeze(data.pages);
    return Object.freeze(data);
  }, isEqual), [studio, models]);
  const data = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return data ?? EMPTY_PROJECT_DATA;
}

const EMPTY_PROJECT_DATA: ReturnType<StudioCtx["getProjectData"]> = { components: [], pages: [] };
Object.freeze(EMPTY_PROJECT_DATA.components); Object.freeze(EMPTY_PROJECT_DATA.pages); Object.freeze(EMPTY_PROJECT_DATA);
