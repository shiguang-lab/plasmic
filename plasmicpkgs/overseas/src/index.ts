import { registerAppShell, Registerable } from "./registerAppShell";
export * from "./registerAppShell";
export function registerAll(loader?: Registerable) { registerAppShell(loader); }
