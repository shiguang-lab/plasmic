import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { ApplicationPageLoading } from "@/wab/client/components/ApplicationPageLoading";
import { LoadingError } from "@/wab/client/components/widgets/LoadingError";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

beforeEach(() => setLanguagePreference("en"));
afterEach(cleanup);

function setup(path: string, retry?: () => void) {
  return render(
    <AntdConfigProvider>
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

it("keeps dashboard navigation and exposes retry when startup fails", () => {
  const retry = vi.fn();
  setup("/projects", retry);
  expect(screen.getByRole("link", { name: /All projects/ })).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

it("renders editor chrome before the application context exists", () => {
  const { container } = setup("/projects/project");
  expect(container.querySelector(".canvas-editor")).toBeTruthy();
  expect(screen.getByRole("toolbar", { name: "Canvas view" })).toBeTruthy();
});

it("keeps editor chrome and replaces loading with an error and retry", () => {
  const { container } = setup("/projects/project", vi.fn());
  expect(container.querySelector(".canvas-editor")).toBeTruthy();
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
