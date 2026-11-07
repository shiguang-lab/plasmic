export type JsOrTs = "js" | "ts";
export type PlatformType = "nextjs" | "react" | "tanstack";
export type PlatformOptions = {
  nextjs?: {
    appDir: boolean;
  };
};
export type SchemeType = "codegen" | "loader";
export type PackageManagerType = "npm" | "yarn" | "yarn2" | "pnpm";

export type PlasmicCssImport = {
  projectId: string;
  importPath: string;
};

export function platformTypeToString(s: PlatformType): string {
  return s === "nextjs"
    ? "Next.js"
    : s === "tanstack"
    ? "TanStack"
    : "React";
}
