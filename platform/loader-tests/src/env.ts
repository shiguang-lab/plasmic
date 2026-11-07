import process from "process";

export const PNPM_CACHE_DIR = "/tmp/.loader-pnpm-store";

const DEFAULT_ENV = {
  NPM_CONFIG_REGISTRY: "https://registry.npmjs.org",
  NPM_CONFIG_CACHE: "",
  WAB_HOST: "http://127.0.0.1:3003",
  WAB_USER_EMAIL: "admin@admin.example.com",
  WAB_USER_PASSWORD: "!53kr3tz!",
} as const;

export function getEnvVar(variable: keyof typeof DEFAULT_ENV): string {
  const value = process.env[variable] ?? DEFAULT_ENV[variable];

  return variable === "WAB_HOST" || variable === "NPM_CONFIG_REGISTRY"
    ? (maybeSwapWithDockerLocalhost(value) as string)
    : value;
}

export const REACT_VERSION = "19.3.1";
export const REACT_TYPES_VERSION = "19.3.0";
export const LOADER_REACT_VERSION = "3.0.0";
export const LOADER_NEXTJS_VERSION = "3.0.0";
export const NEXTJS_TEST_VERSIONS = {
  loaderVersion: LOADER_NEXTJS_VERSION,
  reactVersion: REACT_VERSION,
  nextVersion: "16.4.5",
};

export const LOADER_NEXTJS_TEMPLATES = [
  { ...NEXTJS_TEST_VERSIONS, template: "template-pages" },
  { ...NEXTJS_TEST_VERSIONS, template: "template-app" },
];
export const LOADER_NEXTJS_VERSIONS = [NEXTJS_TEST_VERSIONS];
export const LOADER_REACT_VERSIONS = [
  { reactVersion: REACT_VERSION, loaderReactVersion: LOADER_REACT_VERSION },
];

function maybeSwapWithDockerLocalhost(value: string | undefined) {
  if (value && process.env["WITHIN_DOCKER"]) {
    return value.replace("localhost", "host.docker.internal");
  }
  return value;
}
