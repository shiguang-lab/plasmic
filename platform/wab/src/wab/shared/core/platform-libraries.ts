/**
 * Code component libraries that no longer receive releases. Projects keep the
 * versions they installed, so these libraries stay outside the platform
 * library workspace whose members are upgraded automatically.
 */
export const RETIRED_HOSTLESS_LIBRARIES: readonly string[] = ["antd5"];

export function isRetiredHostlessLibrary(name: string) {
  return RETIRED_HOSTLESS_LIBRARIES.includes(name);
}
