import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ApplicationPageLoading } from "@/wab/client/components/ApplicationPageLoading";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { createMemoryHistory } from "history";
import { resolve } from "path";
import * as React from "react";

// Load the real lazy route graph before measuring its rendered states. Vite's
// cold TypeScript transforms are not the application's network loading state.
beforeAll(async () => {
  await import("./ApplicationRouteLoading");
});
beforeEach(async () => await setLanguagePreference("en"));
afterEach(cleanup);

function setup(path: string, retry?: () => void) {
  return render(
    <AntdConfigProvider productUI>
      <HistoryProvider
        history={createMemoryHistory({ initialEntries: [path] })}
      >
        <ApplicationPageLoading
          failure={retry && <LoadingError onRetry={retry} />}
        />
      </HistoryProvider>
    </AntdConfigProvider>,
  );
}

it("keeps dashboard navigation and exposes retry when startup fails", async () => {
  const retry = vi.fn();
  setup("/projects", retry);
  expect(await screen.findByRole("radio", { name: "Projects" }, { timeout: 10000 })).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(document.querySelector(".ant-alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

it("uses project skeletons inside main while the dashboard starts", async () => {
  const { container } = setup("/projects");
  const loading = await screen.findByRole("status", { name: "Loading projects…" }, { timeout: 10000 });
  expect(screen.getByRole("main").contains(loading)).toBe(true);
  expect(loading.querySelector(".ant-skeleton")).toBeTruthy();
  expect(container.querySelector(".ant-spin, .loader-container")).toBeNull();
});

it("renders editor chrome before the application context exists", () => {
  const { container } = setup("/projects/project");
  expect(container.querySelector(".canvas-editor")).toBeTruthy();
  expect(screen.getByRole("toolbar", { name: "Canvas view" })).toBeTruthy();
  const loading = screen.getByRole("status", { name: "Loading project…" });
  expect(
    container
      .querySelector(".canvas-editor__canvas-container")
      ?.contains(loading),
  ).toBe(true);
  expect(loading.querySelectorAll(".studio-loading__artboard")).toHaveLength(3);
  expect(loading.querySelectorAll(".studio-loading__row")).toHaveLength(15);
  expect(
    loading.querySelectorAll(".ant-skeleton-active .ant-skeleton-input").length,
  ).toBeGreaterThan(0);
  expect(
    container.querySelector(".ant-spin, .studio-loading__spinner"),
  ).toBeNull();
});

it.each([
  ["dark", "rgb(21, 22, 27)"],
  ["light", "rgb(236, 238, 243)"],
] as const)(
  "uses the %s theme in the loading canvas",
  (appearance, background) => {
    setAppearancePreference(appearance);
    const { container } = setup("/projects/project");
    const canvas = container.querySelector(".canvas-editor__canvas-container");
    expect(canvas).toBeTruthy();
    expect(getComputedStyle(canvas as Element).backgroundColor).toBe(
      background,
    );
  },
);

it("keeps editor chrome and replaces loading with an error and retry", () => {
  const { container } = setup("/projects/project", vi.fn());
  expect(container.querySelector(".canvas-editor")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  expect(screen.queryByRole("status", { name: "Loading project…" })).toBeNull();
});

it("keeps compact canvas placeholders from inheriting Antd's default input dimensions", () => {
  const css = readFileSync(resolve(process.cwd(), "public/index.html"), "utf8");
  const rule = css.match(/\.studio-loading \.ant-skeleton[^{}]*\{[^}]*\}/)?.[0];
  expect(rule).toBeTruthy();
  const style = document.createElement("style");
  style.textContent = rule ?? "";
  document.head.appendChild(style);
  try {
    const { container } = setup("/projects/project");
    const input = container.querySelector(
      ".studio-loading__sidebar .ant-skeleton-input",
    );
    expect(input).toBeTruthy();
    expect(getComputedStyle(input as Element).width).toBe("100%");
    expect(getComputedStyle(input as Element).height).toBe("100%");
  } finally {
    style.remove();
  }
});

it.each(["/projects/project/preview", "/d/0123456789"])(
  "uses preview loading without a startup boundary for %s",
  (mode) => {
    const { container } = setup(`${mode}#/home`);
    expect(screen.getByText("Loading preview…")).toBeTruthy();
    expect(container.querySelectorAll(".preview-loading__page")).toHaveLength(
      3,
    );
    expect(container.querySelector(".canvas-editor, .ant-skeleton")).toBeNull();
  },
);

it.each([
  ["/projects/project/preview#/home", "preview-startup-loading"],
  ["/d/0123456789#/home", "preview-startup-loading"],
  ["/d/0123456789#/", "preview-startup-loading"],
  ["/projects/project", "studio-startup-loading"],
  ["/projects/project/-/preview-full", "studio-startup-loading"],
])(
  "selects the correct bootstrap loading screen for %s before React starts",
  (pathname, expected) => {
    const html = readFileSync(
      resolve(process.cwd(), "public/index.html"),
      "utf8",
    );
    const script = html
      .split("<script>")
      .find((part) =>
        part.includes('getElementById("preview-startup-loading")'),
      )
      ?.split("</script>")[0];
    expect(script).toBeTruthy();
    const shown: string[] = [];
    const bootstrapDocument = {
      getElementById: (id: string) => ({
        classList: { add: () => shown.push(id) },
      }),
    };
    new Function("window", "document", script ?? "")(
      { location: { pathname: new URL(pathname, "http://localhost").pathname } },
      bootstrapDocument,
    );
    expect(shown).toEqual([expected]);
  },
);

it("replaces the spaces navigation skeleton with a page failure state", async () => {
  setup("/orgs/org", vi.fn());
  const failure = await screen.findByRole("alert");
  expect(screen.getByRole("main").contains(failure)).toBe(true);
  expect(
    screen
      .getByRole("main")
      .querySelector(".spacesNavigation, .ant-skeleton, .ant-alert"),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

beforeEach(() => registerPresentationProject("0123456789", "project" as import("@/wab/shared/ApiSchema").ProjectId));
