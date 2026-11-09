const isDefaultValue = (val: unknown) =>
  val === "PLEASE_RENDER_INSIDE_PROVIDER";
const seenDefaultVariants: Record<string, boolean> = {};

type ActiveGlobalVariants = string | string[] | undefined;
export type GlobalVariants = { [gv: string]: ActiveGlobalVariants };
export type UseGlobalVariants = () => GlobalVariants;

export function ensureGlobalVariants<T extends GlobalVariants>(
  globalVariants: T
): GlobalVariants {
  Object.entries(globalVariants)
    .filter(([_, value]) => isDefaultValue(value))
    .forEach(([key, _]) => {
      if (!seenDefaultVariants[key] && process.env.NODE_ENV === "development") {
        seenDefaultVariants[key] = true;
        const providerName = `${key[0].toUpperCase()}${key.substring(
          1
        )}Context.Provider`;
        console.warn(
          `Plasmic context value for global variant "${key}" was not provided; please use ${providerName} at the root of your React app. Learn More: https://www.plasmic.app/learn/other-assets/#global-variants`
        );
      }
    });
  return Object.fromEntries(Object.entries(globalVariants).map(([key, value]) => [key, isDefaultValue(value) ? undefined : value]));
}
