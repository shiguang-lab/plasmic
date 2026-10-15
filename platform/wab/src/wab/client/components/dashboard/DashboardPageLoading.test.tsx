import { AntdConfigProvider } from "@/wab/client/antd-theme";
import type { AppCtx } from "@/wab/client/app-ctx";
import { DashboardPageLoading } from "@/wab/client/components/dashboard/DashboardPageLoading";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { setLanguagePreference } from "@/wab/client/i18n";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import dashboard from "@/wab/client/components/dashboard/dashboard.module.scss";
import * as React from "react";

const deployment = vi.hoisted(() => ({ selfHosted: false }));
vi.mock("@/wab/client/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/env")>()),
  get SELF_HOSTED() { return deployment.selfHosted; },
}));

beforeEach(async () => {
  deployment.selfHosted = false;
  await setLanguagePreference("en");
  setAppearancePreference("dark");
});
afterEach(cleanup);
const appCtx = {
  appConfig: { enableDataQueries: true },
  personalWorkspace: { id: "personal", name: "My Playground" },
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
  const { container } = setup("/workspaces/workspace");
  expect(screen.getByText("Customer portal")).toBeTruthy();
  expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
  expect(screen.getByText("Projects", { selector: "div" })).toBeTruthy();
  expect(screen.getByText("Data sources")).toBeTruthy();
  expect(container.querySelector(".ant-tabs-nav")?.parentElement?.contains(screen.getByPlaceholderText("Search…"))).toBe(true);
  expect(container.querySelector("header")?.contains(screen.getByPlaceholderText("Search…"))).toBe(false);
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
  expect(screen.queryByRole("radio", { name: /List/ })).toBeNull();
  expect(screen.getByRole("button", { name: "New workspace" })).toBeTruthy();
});
it("shows profile and preferences while settings lists are pending", () => {
  setup("/settings");
  expect(screen.getByText("Test User")).toBeTruthy();
  expect(screen.getByLabelText("Appearance")).toBeTruthy();
  expect(screen.getAllByRole("status")).toHaveLength(2);
});
it("uses the data-source layout for a pending integration tab", () => {
  setup("/workspaces/workspace#tab=dataSources");
  expect(screen.queryByText("Content Management Systems (CMS)")).toBeNull();
  expect(screen.getByRole("button", { name: "New data source" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: /List/ })).toBeNull();
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
      ?.parentElement?.contains(screen.getByPlaceholderText("Search…")),
  ).toBe(true);
  expect(
    screen.getByRole("tabpanel").querySelector(".ant-skeleton"),
  ).toBeTruthy();
});
it("keeps the complete project toolbar without a temporary heading while loading", () => {
  const { container } = setup("/projects", false);
  expect(screen.queryByRole("heading", { name: "All projects" })).toBeNull();
  expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
  expect(screen.getByText("All workspaces")).toBeTruthy();
  expect(container.querySelector(`.${dashboard.groupHeading}`)).toBeTruthy();
  expect(container.querySelector(".ant-skeleton-avatar")).toBeNull();
  expect(
    screen.getByRole("status", { name: "Loading projects…" }),
  ).toBeTruthy();
});

it("uses the personal workspace layout on its workspace URL too", () => {
  const { container } = setup("/workspaces/personal");
  expect(container.querySelector("header")).toBeNull();
  expect(screen.getByRole("tab", { name: "Projects", selected: true })).toBeTruthy();
});

it("matches the empty organizations page before organization data is available", () => {
  const { container } = setup("/orgs", false);
  expect(container.querySelector(`.${dashboard.spacesEmpty}`)).toBeTruthy();
  expect(screen.getByRole("button", { name: "New organization" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("No organizations yet.")).toBeNull();
});

it("keeps known member filters and billing headings in organization settings", () => {
  setup("/orgs/org/settings");
  expect(screen.getByText("Design team")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Search members")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Billing" })).toBeTruthy();
  expect(screen.getByText("Current plan")).toBeTruthy();
});

it("shows only organization and member controls while self-hosted settings load", () => {
  deployment.selfHosted = true;
  setup("/orgs/org/settings");
  expect(screen.getByText("Design team")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Search members")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Billing" })).toBeNull();
  expect(screen.queryByText("Current plan")).toBeNull();
  expect(screen.queryByText("Billing frequency")).toBeNull();
});
