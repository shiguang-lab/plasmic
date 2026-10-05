import { registerActionGroup, Registerable } from "./registerActionGroup";
export * from "./registerActionGroup";
export function registerAll(loader?: Registerable) { registerActionGroup(loader); }
