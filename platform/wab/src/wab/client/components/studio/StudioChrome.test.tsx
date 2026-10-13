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
    rerender: (content: React.ReactNode) => rendered.rerender(view(content)),
  };
}

it("keeps one skeleton and its animation nodes across app startup, app context, lazy route and canvas initialization", async () => {
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
  const skeleton = screen.getByRole("status");
  const input = skeleton.querySelector(".ant-skeleton-input");
  const unchanged = () => {
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(skeleton);
    expect(skeleton.querySelector(".ant-skeleton-input")).toBe(input);
    expect(skeleton.isConnected).toBe(true);
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
});

it("keeps the first-paint HTML skeleton until ready without mounting a second skeleton", () => {
  const bootstrap = document.createElement("div");
  bootstrap.id = "studio-startup-loading";
  bootstrap.className = "studio-loading visible";
  bootstrap.setAttribute("role", "status");
  bootstrap.innerHTML = '<div class="studio-loading__placeholder"></div>';
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

it("reveals startup failures and restores the HTML skeleton on retry", () => {
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

it("shows startup failures and retry through the owner instead of covering them with a skeleton", () => {
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

it.each(["preview", "preview-full"])(
  "uses preview loading throughout %s startup and removes it when ready",
  (mode) => {
    const { rerender } = setup(
      <ApplicationPageLoading />,
      `/projects/project/${mode}/home`,
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Loading preview…")).toBeTruthy();
    expect(
      document.querySelector(".canvas-editor, .studio-loading, .ant-skeleton"),
    ).toBeNull();
    rerender(<StudioChrome />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    rerender(<ReadyCanvas ready />);
    expect(screen.queryByRole("status")).toBeNull();
  },
);

it("shows preview startup failures with retry without editor chrome", () => {
  const retry = vi.fn();
  setup(
    <ApplicationPageLoading failure={<LoadingError onRetry={retry} />} />,
    "/projects/project/preview-full/home",
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(document.querySelector(".canvas-editor")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
