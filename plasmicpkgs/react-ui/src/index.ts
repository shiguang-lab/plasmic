import { Registerable, registerActionGroup } from "./registerActionGroup";
import { registerResourceAuthorization } from "./registerResourceAuthorization";
export * from "./registerActionGroup";
export * from "./registerResourceAuthorization";
export function registerAll(loader?: Registerable) {
  registerActionGroup(loader);
  registerResourceAuthorization(loader);
}
