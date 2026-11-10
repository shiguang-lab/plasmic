import { LoadingAnimationContext } from "@/wab/client/contexts/LoadingAnimationContext";
import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ApplicationPageLoading } from "@/wab/client/components/ApplicationPageLoading";
import {
  StudioChrome,
  StudioStartupBoundary,
  useStudioStartup,
} from "@/wab/client/components/studio/StudioChrome";
import { Loadable } from "@/wab/client/components/widgets";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

afterEach(cleanup);

function ReadyCanvas({ ready }: { ready: boolean }) {
  const update = useStudioStartup();
  React.useLayoutEffect(() => update({ ready }), [update, ready]);
  return <div>Real canvas</div>;
}

function setup(children: React.ReactNode, path = "/projects/project") {
  const history = createMemoryHistory({
    initialEntries: [path],
  });
  const view = (content: React.ReactNode) => (
    <HistoryProvider history={history}>
      <AntdConfigProvider productUI>
        <StudioStartupBoundary>{content}</StudioStartupBoundary>
      </AntdConfigProvider>
    </HistoryProvider>
  );
  const rendered = render(view(children));
  return {
    history,
    container: rendered.container,
    rerender: (content: React.ReactNode) => rendered.rerender(view(content)),
  };
}

it("keeps one logo and its animation nodes across app startup, app context, lazy route and canvas initialization", async () => {
  let releaseStartup!: () => void;
  let releaseAppCtx!: () => void;
  let releaseRoute!: () => void;
  const startup = new Promise<number>((resolve) => {
    releaseStartup = () => resolve(1);
  });
  const appCtx = new Promise<number>((resolve) => {
    releaseAppCtx = () => resolve(1);
  });
  const LazyRoute = React.lazy(
    () =>
      new Promise<{ default: React.ComponentType }>((resolve) => {
        releaseRoute = () =>
          resolve({ default: () => <ReadyCanvas ready={false} /> });
      }),
  );
  const loading = () => <ApplicationPageLoading />;
  const { rerender } = setup(
    <Loadable
      loader={() => startup}
      loadingContents={loading}
      contents={() => (
        <Loadable
          loader={() => appCtx}
          loadingContents={loading}
          contents={() => (
            <React.Suspense fallback={<StudioChrome />}>
              <LazyRoute />
            </React.Suspense>
          )}
        />
      )}
    />,
  );
  const loadingNode = screen.getByRole("status");
  const input = screen.getByRole("textbox", {
    name: "Describe changes or a new page…",
  });
  expect(input.getAttribute("aria-disabled")).toBe("false");
  input.focus();
  fireEvent.input(input, {
    target: { innerText: "Prepare the canvas while it loads" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Send AI request",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  const logo = loadingNode.querySelector("svg [data-solid]");
  expect(logo).toBeTruthy();
  const unchanged = () => {
    expect(
      screen.getByRole("textbox", { name: "Describe changes or a new page…" }),
    ).toBe(input);
    expect(input.innerText).toBe("Prepare the canvas while it loads");
    expect(document.activeElement).toBe(input);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(loadingNode);
    expect(loadingNode.querySelector("svg [data-solid]")).toBe(logo);
    expect(loadingNode.isConnected).toBe(true);
  };
  await act(async () => releaseStartup());
  unchanged();
  await act(async () => releaseAppCtx());
  unchanged();
  await act(async () => releaseRoute());
  expect(screen.getByText("Real canvas")).toBeTruthy();
  unchanged();
  rerender(<ReadyCanvas ready />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen.getByRole("textbox", { name: "Describe changes or a new page…" }),
  ).toBe(input);
});

it("omits the covered Host loading shell while keeping local errors and retry", () => {
  const retry = vi.fn();
  const host = (revealed: boolean, failure?: React.ReactNode) => (
    <AntdConfigProvider productUI>
      <HistoryProvider history={createMemoryHistory({
        initialEntries: ["/projects/project"],
      })}>
        <LoadingAnimationContext.Provider value={revealed}>
          <StudioChrome>{failure}</StudioChrome>
        </LoadingAnimationContext.Provider>
      </HistoryProvider>
    </AntdConfigProvider>
  );
  const { container, rerender } = render(host(false));
  expect(container.querySelector(".canvas-editor")).toBeNull();
  rerender(host(false, <LoadingError onRetry={retry} />));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(host(true));
  expect(container.querySelector(".canvas-editor")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps the first-paint HTML logo until ready without mounting a second logo", () => {
  const bootstrap = document.createElement("div");
  bootstrap.id = "studio-startup-loading";
  bootstrap.className = "studio-loading visible";
  bootstrap.setAttribute("role", "status");
  bootstrap.innerHTML = '<svg class="startup-loading__logo"></svg>';
  document.body.appendChild(bootstrap);
  try {
    const placeholder = bootstrap.firstElementChild;
    const { rerender, history } = setup(<ApplicationPageLoading />);
    expect(document.querySelectorAll(".studio-loading")).toHaveLength(1);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    rerender(<StudioChrome projectName="Project" />);
    expect(bootstrap.firstElementChild).toBe(placeholder);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    rerender(<ReadyCanvas ready />);
    expect(bootstrap.classList.contains("fadeOut")).toBe(true);
    rerender(null);
    act(() => history.push("/projects/other"));
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    expect(bootstrap.firstElementChild).toBe(placeholder);
    act(() => history.push("/projects"));
    expect(bootstrap.classList.contains("fadeOut")).toBe(true);
  } finally {
    cleanup();
    bootstrap.remove();
  }
});

it("reveals startup failures and restores the HTML logo on retry", () => {
  const bootstrap = document.createElement("div");
  bootstrap.id = "studio-startup-loading";
  bootstrap.className = "studio-loading visible";
  document.body.appendChild(bootstrap);
  try {
    const retry = vi.fn();
    const { rerender } = setup(
      <ApplicationPageLoading failure={<LoadingError onRetry={retry} />} />,
    );
    expect(bootstrap.classList.contains("fadeOut")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<ApplicationPageLoading />);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    expect(document.querySelectorAll(".studio-loading")).toHaveLength(1);
  } finally {
    cleanup();
    bootstrap.remove();
  }
});

it("shows startup failures and retry through the owner instead of covering them with a loader", () => {
  const retry = vi.fn();
  const { rerender } = setup(
    <ApplicationPageLoading failure={<LoadingError onRetry={retry} />} />,
  );
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<ApplicationPageLoading />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
});

it("starts loading for a new project but not for arena or slug changes within a ready project", () => {
  const { history, rerender } = setup(<ReadyCanvas ready />);
  rerender(null);
  act(() => history.push("/projects/project/-/Page?arena=Page"));
  expect(screen.queryByRole("status")).toBeNull();
  act(() => history.push("/projects/other"));
  expect(screen.getByRole("status")).toBeTruthy();
  act(() => history.push("/projects"));
  expect(screen.queryByRole("status")).toBeNull();
  act(() => history.push("/projects/project"));
  expect(screen.getByRole("status")).toBeTruthy();
});

it.each(["/projects/project/preview", "/d/0123456789"])(
  "uses preview loading throughout %s startup and removes it when ready",
  (mode) => {
    const { rerender } = setup(<ApplicationPageLoading />, `${mode}#/home`);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen
        .getByRole("status", { name: "Loading preview…" })
        .querySelector("svg"),
    ).toBeTruthy();
    expect(
      document.querySelector(".canvas-editor, .studio-loading, .ant-skeleton"),
    ).toBeNull();
    rerender(<StudioChrome />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    rerender(<ReadyCanvas ready />);
    expect(screen.queryByRole("status")).toBeNull();
  },
);

it.each(["/projects/project/preview", "/d/fresh12345"])(
  "preserves the first-paint preview logo through startup and route resolution at %s",
  (mode) => {
    const bootstrap = document.createElement("div");
    bootstrap.id = "preview-startup-loading";
    bootstrap.className = "preview-loading visible";
    bootstrap.setAttribute("role", "status");
    bootstrap.innerHTML = "<svg><g data-solid></g></svg>";
    document.body.append(bootstrap);
    try {
      const logo = bootstrap.querySelector("svg");
      const { rerender, history } = setup(
        <ApplicationPageLoading />,
        `${mode}#/home`,
      );
      const unchanged = () => {
        expect(screen.getAllByRole("status")).toEqual([bootstrap]);
        expect(bootstrap.querySelector("svg")).toBe(logo);
        expect(bootstrap.classList.contains("fadeOut")).toBe(false);
        expect(document.querySelector(".canvas-editor")).toBeNull();
      };
      unchanged();
      if (mode.startsWith("/d/")) {
        registerPresentationProject(
          "fresh12345",
          "project" as import("@/wab/shared/ApiSchema").ProjectId,
        );
      }
      rerender(<StudioChrome />);
      unchanged();
      rerender(<ReadyCanvas ready={false} />);
      unchanged();
      act(() => history.push(`${mode}#/next`));
      unchanged();
      rerender(<ReadyCanvas ready />);
      expect(bootstrap.classList.contains("fadeOut")).toBe(true);
      act(() => history.push(`${mode}#/home`));
      expect(bootstrap.classList.contains("fadeOut")).toBe(true);
    } finally {
      cleanup();
      bootstrap.remove();
    }
  },
);

it("reveals preview failures and restores the same HTML logo on retry", () => {
  const bootstrap = document.createElement("div");
  bootstrap.id = "preview-startup-loading";
  bootstrap.className = "preview-loading visible";
  bootstrap.setAttribute("role", "status");
  bootstrap.innerHTML = "<svg></svg>";
  document.body.append(bootstrap);
  try {
    const retry = vi.fn();
    const { rerender } = setup(
      <ApplicationPageLoading />,
      "/d/0123456789#/home",
    );
    const logo = bootstrap.firstElementChild;
    rerender(
      <ApplicationPageLoading failure={<LoadingError onRetry={retry} />} />,
    );
    expect(bootstrap.classList.contains("fadeOut")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<ApplicationPageLoading />);
    expect(bootstrap.classList.contains("fadeOut")).toBe(false);
    expect(bootstrap.firstElementChild).toBe(logo);
    expect(screen.getAllByRole("status")).toEqual([bootstrap]);
  } finally {
    cleanup();
    bootstrap.remove();
  }
});

it("shows preview startup failures with retry without editor chrome", () => {
  const retry = vi.fn();
  setup(
    <ApplicationPageLoading failure={<LoadingError onRetry={retry} />} />,
    "/d/0123456789#/home",
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(document.querySelector(".canvas-editor")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

it.each(["/projects/project/preview", "/d/0123456789"])(
  "keeps a lazy sign-in failure inside a loading boundary during %s startup",
  async (mode) => {
    let releaseSignIn!: () => void;
    const SignIn = React.lazy(
      () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
          releaseSignIn = () =>
            resolve({ default: () => <div>Sign in to preview</div> });
        }),
    );
    class ErrorBoundary extends React.Component<
      React.PropsWithChildren,
      { failed: boolean }
    > {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? (
          <div>Startup crashed</div>
        ) : (
          this.props.children
        );
      }
    }
    const history = createMemoryHistory({ initialEntries: [`${mode}#/home`] });
    render(
      <HistoryProvider history={history}>
        <AntdConfigProvider productUI>
          <ErrorBoundary>
            <StudioStartupBoundary>
              <Loadable
                loader={async () => true}
                contents={() => (
                  <React.Suspense fallback={<ApplicationPageLoading />}>
                    <ApplicationPageLoading failure={<SignIn />} />
                  </React.Suspense>
                )}
                loadingContents={() => <ApplicationPageLoading />}
              />
            </StudioStartupBoundary>
          </ErrorBoundary>
        </AntdConfigProvider>
      </HistoryProvider>,
    );
    await act(() => Promise.resolve());
    expect(screen.queryByText("Startup crashed")).toBeNull();
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Loading preview…",
    );
    await act(async () => releaseSignIn());
    expect(screen.getByText("Sign in to preview")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  },
);

it("provides one desktop update slot after the loading editor brand capsule", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  const { container } = setup(<ApplicationPageLoading />);
  const slot = container.querySelector('[data-desktop-update-slot="header"]');
  expect(slot).toBeTruthy();
  expect(
    container.querySelectorAll('[data-desktop-update-slot="header"]'),
  ).toHaveLength(1);
  expect(
    slot?.previousElementSibling?.querySelector(".editor-project-title"),
  ).toBeTruthy();
  expect(slot?.closest(".canvas-editor__top-bar")).toBeTruthy();
  expect(slot?.getAttribute("data-desktop-update-position")).toBeNull();
  expect(slot?.closest(".editor-tool-rail-group")).toBeNull();
  vi.restoreAllMocks();
});

it("hides web import throughout browser startup", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36",
  );
  try {
    const { container, rerender } = setup(<ApplicationPageLoading />);
    expect(
      container.querySelector('[data-test-id="import-from-web-button"]'),
    ).toBeNull();
    rerender(<StudioChrome projectName="Project" />);
    expect(
      container.querySelector('[data-test-id="import-from-web-button"]'),
    ).toBeNull();
  } finally {
    vi.restoreAllMocks();
  }
});

it("keeps the Desktop web import action inside the tool rail and opens it through the native bridge", () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "PlasmicDesktop/darwin",
  );
  const open = vi.fn();
  vi.stubGlobal("desktopBrowser", { open });
  try {
    const { container, rerender } = setup(<ApplicationPageLoading />);
    const button = container.querySelector(
      '[data-test-id="import-from-web-button"]',
    );
    expect(button?.closest("#left-tab-strip")).toBeTruthy();
    expect(button?.getAttribute("aria-label")).toBe("Import from the web");
    fireEvent.click(
      screen.getByRole("button", { name: "Import from the web" }),
    );
    expect(open).toHaveBeenCalledOnce();
    rerender(<StudioChrome projectName="Project" />);
    expect(
      container.querySelectorAll('[data-test-id="import-from-web-button"]'),
    ).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

beforeEach(() =>
  registerPresentationProject(
    "0123456789",
    "project" as import("@/wab/shared/ApiSchema").ProjectId,
  ),
);
