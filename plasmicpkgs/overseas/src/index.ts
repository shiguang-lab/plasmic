import { registerAppShell, Registerable } from "./registerAppShell";
import { registerSearchForm } from "./registerSearchForm";
export * from "./registerAppShell";
export * from "./SearchForm";
export * from "./registerSearchForm";
export function registerAll(loader?: Registerable) { registerAppShell(loader); registerSearchForm(loader); }
