import { Registerable, registerActionGroup } from "./registerActionGroup";
import { registerResourceAuthorization } from "./registerResourceAuthorization";
import { registerIntlComponents } from "./registerIntlComponents";
export * from "./registerActionGroup";
export * from "./registerResourceAuthorization";
export * from "./registerIntlComponents";
export function registerAll(loader?: Registerable) {
  registerActionGroup(loader);
  registerResourceAuthorization(loader);
  registerIntlComponents(loader);
}
