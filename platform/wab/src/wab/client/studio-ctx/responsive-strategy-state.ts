import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { getResponsiveStrategyFromMediaQueries } from "@/wab/shared/core/sites";
import type { Site } from "@/wab/shared/model/classes";
import * as React from "react";

/** This form demands only the active screen group, its variant identities and
 * their media queries. The selected snapshot is the strategy enum itself. */
function createResponsiveStrategySource(models: ModelSnapshots, site: Site) {
  const activeGroup = models.field(site, "activeScreenVariantGroup");
  const read = () => {
    const fields = new Set<ModelFieldStore<unknown>>([activeGroup]);
    const groupRef = activeGroup.getState();
    const queries: (string | null | undefined)[] = [];
    if (groupRef) {
      const variants = models.field(models.resolve(groupRef), "variants");
      fields.add(variants);
      for (const ref of variants.getState()) {
        const query = models.field(models.resolve(ref), "mediaQuery");
        fields.add(query);
        queries.push(query.getState());
      }
    }
    return { fields, strategy: getResponsiveStrategyFromMediaQueries(queries) };
  };
  return {
    getSnapshot: () => read().strategy,
    subscribe: (listener: () => void) => {
      const stops = new Map<ModelFieldStore<unknown>, () => void>();
      let strategy = read().strategy;
      const sync = () => {
        const next = read();
        for (const [field, stop] of stops) {
          if (!next.fields.has(field)) { stop(); stops.delete(field); }
        }
        for (const field of next.fields) {
          if (!stops.has(field)) { stops.set(field, field.subscribe(sync)); }
        }
        if (next.strategy !== strategy) {
          strategy = next.strategy;
          listener();
        }
      };
      sync();
      return () => { stops.forEach((stop) => stop()); stops.clear(); };
    },
  };
}

export function useResponsiveStrategy(studio: StudioCtx) {
  const models = studio.modelSnapshots;
  const site = studio.site;
  const source = React.useMemo(() => createResponsiveStrategySource(models, site), [models, site]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
