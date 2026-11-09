/** Studio, iframe-owned components and their runtime share one Compiler contract. */
export const reactCompilerInclude =
  /(?:[\\/]src[\\/]wab[\\/](?!server[\\/](?!emails[\\/]))|[\\/](?:canvas-packages|react-web-bundle|live-frame|sub)[\\/]src[\\/]|[\\/]packages[\\/]react-web[\\/]src[\\/])(?!.*(?:[\\/]__(?:testonly|tests|mocks)__[\\/]|[.-](?:test|spec|stories)\.[^\\/]+$|\.d\.ts$)).*\.[jt]sx?$/;

// React exposes descendant error capture only through class lifecycles. These
// native boundaries are counted separately; business classes are failures.
export const reactRequiredErrorBoundaries = [
  { file: "../canvas-packages/src/canvas-error.tsx", name: "CanvasErrorBoundary" },
  { file: "../canvas-packages/src/error-boundary.tsx", name: "GenericErrorBoundary" },
  { file: "../live-frame/src/render.tsx", name: "PreviewErrorBoundary" },
];

export function isReactRequiredErrorBoundary(candidate) {
  return candidate.kind === "class" && candidate.errorCapture === true &&
    reactRequiredErrorBoundaries.some(({ file, name }) => candidate.file === file && candidate.name === name);
}

/** @param {import('babel-plugin-react-compiler').Logger | null} [logger] */
export function reactCompilerOptions(logger = null) {
  return {
    compilationMode: /** @type {const} */ ("infer"),
    target: /** @type {const} */ ("19"),
    panicThreshold: /** @type {const} */ ("all_errors"),
    logger,
  };
}

export function reactCompilerBuildInfo() {
  return {
    enabled: true,
    target: "19",
    compilationMode: "infer",
    scope: "studio-canvas-runtime-and-emails",
  };
}
