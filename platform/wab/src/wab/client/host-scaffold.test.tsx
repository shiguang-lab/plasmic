import { transformSync } from "esbuild";
import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(process.cwd(), "../sub/src/index.tsx"),
  "utf8",
);
// Execute the real bootstrap with its React dependencies supplied explicitly.
const script = transformSync(
  source.slice(source.indexOf("export function renderHostScaffold")),
  { loader: "tsx", format: "iife" },
).code;
const render = vi.fn();
const createRoot = vi.fn(() => ({ render }));
const host = () => null;
function load(pathname: string) {
  new Function(
    "document",
    "location",
    "createRoot",
    "React",
    "PlasmicCanvasHost",
    script,
  )(
    document,
    { pathname },
    createRoot,
    { createElement: (type: unknown) => ({ type }) },
    host,
  );
}
beforeEach(() => {
  render.mockClear();
  createRoot.mockClear();
  document.body.innerHTML = '<div class="app-root"></div>';
});
afterEach(() => {
  document.body.innerHTML = "";
});

it.each([
  "/static/host.html",
  `/static/host.${"a".repeat(64)}.html`,
  "/canvas-preview/index.html",
])("mounts the Host scaffold on %s", (path) => {
  load(path);
  expect(createRoot).toHaveBeenCalledExactlyOnceWith(
    document.querySelector(".app-root"),
  );
  expect(render).toHaveBeenCalledExactlyOnceWith({ type: host });
});
it.each(["/", "/custom.html", `/static/host.${"a".repeat(63)}.html`])(
  "does not mount a Host on unrelated route %s",
  (path) => {
    load(path);
    expect(createRoot).not.toHaveBeenCalled();
  },
);
it("keeps standalone onboarding visible on the versioned Host", () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<main class="host-ready"></main>',
  );
  load(`/static/host.${"a".repeat(64)}.html`);
  expect(createRoot).not.toHaveBeenCalled();
});
