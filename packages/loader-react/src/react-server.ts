import "server-only";

import { InternalServerPlasmicLoader } from "./loader-server";
import { InitOptions, PlasmicComponentLoader } from "./loader-shared";

export * from "./shared-exports";
export {
  InternalServerPlasmicLoader as InternalPlasmicComponentLoader,
  PlasmicComponentLoader,
};

export function initPlasmicLoader(opts: InitOptions): PlasmicComponentLoader {
  const internal = new InternalServerPlasmicLoader(opts);
  return new PlasmicComponentLoader(internal);
}
