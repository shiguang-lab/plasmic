import OrganizationsPage from "@/wab/client/components/dashboard/OrganizationsPage";
import { HistoryProvider } from "@/wab/client/route/HistoryProvider";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory } from "history";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  empty: false,
  create: vi.fn(),
}));
const appCtx = {
  getAllTeams: () => (mocks.empty ? [] : [{ id: "org", name: "Organization" }]),
};
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => appCtx,
}));
vi.mock("@/wab/client/components/dashboard/dashboard-actions", () => ({
  promptNewTeam: mocks.create,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
afterEach(() => {
  cleanup();
  mocks.empty = false;
  vi.clearAllMocks();
});
function setup() {
  const history = createMemoryHistory({ initialEntries: ["/orgs"] });
  render(
    <HistoryProvider history={history}>
      <OrganizationsPage />
    </HistoryProvider>,
  );
  return history;
}
it("opens the first organization when entering Spaces", () => {
  const history = setup();
  expect(history.location.pathname).toBe("/orgs/org");
});
it("offers organization creation when none exist", () => {
  mocks.empty = true;
  const history = setup();
  expect(screen.getByText("No organizations yet.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New organization" }));
  expect(mocks.create).toHaveBeenCalledWith(appCtx, history);
});
