import { AntdConfigProvider } from "@/wab/client/antd-theme";
import type { AppCtx } from "@/wab/client/app-ctx";
import { DashboardPageLoading } from "@/wab/client/components/dashboard/DashboardPageLoading";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

beforeEach(() => {
  setLanguagePreference("en");
  setAppearancePreference("dark");
});
afterEach(cleanup);
const appCtx = {
  selfInfo: { displayName: "Test User", email: "test@example.com" },
  getAllTeams: () => [{ id: "org", name: "Design team" }],
  workspaces: [
    { id: "workspace", name: "Customer portal", team: { id: "org" } },
  ],
} as unknown as AppCtx;
function setup(path: string, cached = true) {
  return render(
    <AntdConfigProvider>
      <HistoryProvider
        history={createMemoryHistory({ initialEntries: [path] })}
      >
        <AppCtxContext.Provider value={cached ? appCtx : undefined}>
          <DashboardPageLoading />
        </AppCtxContext.Provider>
      </HistoryProvider>
    </AntdConfigProvider>,
  );
}
it("shows cached workspace names and real controls while cards are pending", () => {
  setup("/workspaces/workspace");
  expect(screen.getByText("Customer portal")).toBeTruthy();
  expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
  expect(screen.getByText("Projects", { selector: "div" })).toBeTruthy();
  expect(screen.getByText("Data sources")).toBeTruthy();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
});
it("shows cached organization and workspace names during route loading", () => {
  setup("/orgs/org");
  expect(screen.getByText("Design team")).toBeTruthy();
  expect(screen.getByText("Customer portal")).toBeTruthy();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
});
it("shows profile and preferences while settings lists are pending", () => {
  setup("/settings");
  expect(screen.getByText("Test User")).toBeTruthy();
  expect(screen.getByLabelText("Appearance")).toBeTruthy();
  expect(screen.getAllByRole("status")).toHaveLength(2);
});
it("uses the data-source layout for a pending integration tab", () => {
  setup("/workspaces/workspace#tab=dataSources");
  expect(screen.getByText("Content Management Systems (CMS)")).toBeTruthy();
  expect(
    screen.queryByRole("status", { name: "Loading projects…" }),
  ).toBeNull();
});
it("keeps personal workspace filters in the top tab bar while content is loading", () => {
  const { container } = setup("/playground#tab=dataSources");
  expect(screen.queryByText("My Playground")).toBeNull();
  expect(
    screen.getByRole("tab", { name: "Data sources", selected: true }),
  ).toBeTruthy();
  expect(
    container
      .querySelector(".ant-tabs-nav")
      ?.contains(screen.getByPlaceholderText("Search…")),
  ).toBe(true);
  expect(
    screen.getByRole("tabpanel").querySelector(".ant-skeleton"),
  ).toBeTruthy();
});
it("renders known project headings and the complete toolbar without application data", () => {
  setup("/projects", false);
  expect(screen.getByRole("heading", { name: "All projects" })).toBeTruthy();
  expect(screen.getByText("All workspaces")).toBeTruthy();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
});

it("keeps known member filters and billing headings in organization settings", () => {
  setup("/orgs/org/settings");
  expect(screen.getByText("Design team")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Search members")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Billing" })).toBeTruthy();
  expect(screen.getByText("Current plan")).toBeTruthy();
});
