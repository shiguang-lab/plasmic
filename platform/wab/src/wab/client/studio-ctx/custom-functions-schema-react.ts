import type { DataPickerTypesSchema } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPicker";
import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { Site } from "@/wab/shared/model/classes";
import * as React from "react";

const EMPTY_SCHEMA: DataPickerTypesSchema = Object.freeze({});

/** Function/library catalogs and host registrations affect declarations.
 * Element labels, styles and other document contents never regenerate them. */
export function useCustomFunctionsSchema(studio: StudioCtx | undefined): DataPickerTypesSchema {
  const models = studio?.modelSnapshots;
  const source = React.useMemo(() => {
    if (!studio || !models) { return undefined; }
    const site = studio.site;
    return new ModelFieldSelector(studio, (read) => {
      const visited = new Set<Site>();
      const catalog = (owner: Site) => {
        if (visited.has(owner)) { return; } visited.add(owner);
        for (const ref of read(owner, "customFunctions")) {
          const func = models.resolve(ref);
          read(func, "importName"); read(func, "namespace");
        }
        for (const ref of read(owner, "codeLibraries")) {
          const library = models.resolve(ref);
          read(library, "name"); read(library, "jsIdentifier"); read(library, "importPath");
          read(library, "importType"); read(library, "isSyntheticDefaultImport"); read(library, "namedImport");
        }
        for (const ref of read(owner, "projectDependencies")) {
          const dep = models.resolve(ref); read(dep, "pkgId"); catalog(models.resolve(read(dep, "site")));
        }
      };
      catalog(site);
      return studio.customFunctionsSchema();
    });
  }, [studio, models]);
  const subscribe = React.useCallback((listener: () => void) => {
    if (!studio || !source) { return () => undefined; }
    const stops = [source.subscribe(listener), studio.subscribeCodeRegistrations(source.refresh), studio.hostlessPkgsStore.subscribe(source.refresh)];
    return () => stops.forEach((stop) => stop());
  }, [studio, source]);
  const read = React.useCallback(() => source?.getSnapshot() ?? EMPTY_SCHEMA, [source]);
  return React.useSyncExternalStore(subscribe, read, read);
}
